import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  sprintGoalTable,
  sprintGoalTaskTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { taskIsCompleted } from "../../task/task-is-completed";
import { ARCHIVED_STATUS, CANCELLED_STATUS } from "../../task/workflow-guards";

// Closing a sprint archives its finished tasks, so archived also means done.
export const goalTaskIsDone = sql<boolean>`(${or(
  eq(taskTable.status, ARCHIVED_STATUS),
  taskIsCompleted,
)})`;

const sprintGoalColumns = {
  id: sprintGoalTable.id,
  workspaceId: sprintGoalTable.workspaceId,
  title: sprintGoalTable.title,
  description: sprintGoalTable.description,
  ownerId: sprintGoalTable.ownerId,
  ownerName: userTable.name,
  points: sprintGoalTable.points,
  result: sprintGoalTable.result,
  sprintId: sprintGoalTable.sprintId,
  carriedFromGoalId: sprintGoalTable.carriedFromGoalId,
  carryOverCount: sprintGoalTable.carryOverCount,
  repeatWeekly: sprintGoalTable.repeatWeekly,
  position: sprintGoalTable.position,
  createdAt: sprintGoalTable.createdAt,
  updatedAt: sprintGoalTable.updatedAt,
};

/**
 * Linked tasks per goal, unfinished first so the open work leads. Cancelled
 * tasks are dropped work, so they leave the goal's progress entirely.
 */
async function selectGoalTasks(workspaceId: string, goalIds: string[]) {
  if (goalIds.length === 0) return new Map<string, GoalTask[]>();
  const rows = await db
    .select({
      goalId: sprintGoalTaskTable.goalId,
      id: taskTable.id,
      number: taskTable.number,
      title: taskTable.title,
      status: taskTable.status,
      projectId: projectTable.id,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
      userId: taskTable.userId,
      assigneeName: userTable.name,
      done: goalTaskIsDone,
    })
    .from(sprintGoalTaskTable)
    .innerJoin(taskTable, eq(sprintGoalTaskTable.taskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(
      and(
        inArray(sprintGoalTaskTable.goalId, goalIds),
        eq(projectTable.workspaceId, workspaceId),
        ne(taskTable.status, CANCELLED_STATUS),
      ),
    )
    .orderBy(
      asc(goalTaskIsDone),
      asc(projectTable.name),
      asc(taskTable.number),
    );

  const byGoal = new Map<string, GoalTask[]>();
  for (const { goalId, ...task } of rows) {
    const tasks = byGoal.get(goalId) ?? [];
    tasks.push(task);
    byGoal.set(goalId, tasks);
  }
  return byGoal;
}

type GoalTask = {
  id: string;
  number: number | null;
  title: string;
  status: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  userId: string | null;
  assigneeName: string | null;
  done: boolean;
};

async function selectGoals(workspaceId: string, where: SQL | undefined) {
  const goals = await db
    .select(sprintGoalColumns)
    .from(sprintGoalTable)
    .leftJoin(userTable, eq(sprintGoalTable.ownerId, userTable.id))
    .where(and(eq(sprintGoalTable.workspaceId, workspaceId), where))
    .orderBy(asc(sprintGoalTable.position), asc(sprintGoalTable.createdAt));

  const tasksByGoal = await selectGoalTasks(
    workspaceId,
    goals.map((goal) => goal.id),
  );
  return goals.map((goal) => {
    const tasks = tasksByGoal.get(goal.id) ?? [];
    return {
      ...goal,
      tasks,
      taskCount: tasks.length,
      doneTaskCount: tasks.filter((task) => task.done).length,
    };
  });
}

export function selectOpenGoals(workspaceId: string) {
  return selectGoals(workspaceId, isNull(sprintGoalTable.sprintId));
}

export function selectSprintGoals(workspaceId: string, sprintIds: string[]) {
  if (sprintIds.length === 0) return Promise.resolve([]);
  return selectGoals(workspaceId, inArray(sprintGoalTable.sprintId, sprintIds));
}

export async function selectGoal(workspaceId: string, id: string) {
  const [goal] = await selectGoals(workspaceId, eq(sprintGoalTable.id, id));
  return goal;
}
