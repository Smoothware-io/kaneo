import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  type SprintGoalResult,
  sprintGoalTable,
  sprintTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { getSubtaskParentProjects } from "../../task/get-subtask-parent-projects";
import { taskIsCompleted } from "../../task/task-is-completed";
import {
  ARCHIVED_STATUS,
  statusDetailsWithoutInput,
} from "../../task/workflow-guards";
import { goalScore } from "../goal-score";
import { isoWeek } from "../iso-week";
import { selectSprintGoals } from "./sprint-goal-query";

// Statuses that are not part of a running sprint, so they never carry over.
const OFF_SPRINT_STATUSES = ["planned", "archived", "cancelled"];

export type GoalOutcome = {
  goalId: string;
  result: SprintGoalResult;
  carryOver: boolean;
};

/**
 * Closes the workspace's weekly sprint: every finished task in an active
 * project is archived under this sprint, and every unfinished one stays on
 * the board with its carry-over count raised, so slipping work is visible.
 * Every open goal must be scored; goals taken to the next sprint are copied
 * as fresh open goals so the closed one keeps its result.
 */
async function closeSprint({
  workspaceId,
  currentUserId,
  goals = [],
}: {
  workspaceId: string;
  currentUserId: string;
  goals?: GoalOutcome[];
}) {
  const { sprint, archived, carriedProjectIds } = await db.transaction(
    async (tx) => {
      // Two admins pressing close at once must not create two sprints.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(1526, hashtext(${workspaceId}))`,
      );

      const openGoals = await tx
        .select()
        .from(sprintGoalTable)
        .where(
          and(
            eq(sprintGoalTable.workspaceId, workspaceId),
            isNull(sprintGoalTable.sprintId),
          ),
        );
      const outcomes = new Map(goals.map((goal) => [goal.goalId, goal]));
      if (outcomes.size !== goals.length) {
        throw new HTTPException(400, {
          message: "Each goal can only be scored once",
        });
      }
      const openIds = new Set(openGoals.map((goal) => goal.id));
      if (goals.some((goal) => !openIds.has(goal.goalId))) {
        throw new HTTPException(400, {
          message: "Results were sent for goals that are not open",
        });
      }
      const unscored = openGoals.filter((goal) => !outcomes.has(goal.id));
      if (unscored.length > 0) {
        throw new HTTPException(400, {
          message: `Every open goal needs a result. Missing: ${unscored
            .map((goal) => goal.title)
            .join(", ")}`,
        });
      }

      const activeProjectIds = tx
        .select({ id: projectTable.id })
        .from(projectTable)
        .where(
          and(
            eq(projectTable.workspaceId, workspaceId),
            isNull(projectTable.archivedAt),
          ),
        );

      const closedAt = new Date();
      const { weekYear, week } = isoWeek(closedAt);
      const [created] = await tx
        .insert(sprintTable)
        .values({
          workspaceId,
          weekYear,
          week,
          closedAt,
          closedById: currentUserId,
        })
        .returning();
      if (!created) throw new Error("Failed to record the sprint");

      // Snapshot of the finished rows, so events carry each old status.
      const finishing = tx
        .select({ id: taskTable.id, oldStatus: taskTable.status })
        .from(taskTable)
        .where(
          and(inArray(taskTable.projectId, activeProjectIds), taskIsCompleted),
        )
        .as("finishing");

      const archivedRows = await tx
        .update(taskTable)
        .set({
          status: ARCHIVED_STATUS,
          columnId: null,
          sprintId: created.id,
          ...statusDetailsWithoutInput(ARCHIVED_STATUS),
        })
        .from(finishing)
        .where(eq(taskTable.id, finishing.id))
        .returning({
          id: taskTable.id,
          title: taskTable.title,
          userId: taskTable.userId,
          projectId: taskTable.projectId,
          oldStatus: finishing.oldStatus,
        });

      // Finished tasks are archived by now, so everything still open is
      // unfinished work rolling into next week.
      const carriedRows = await tx
        .update(taskTable)
        .set({ carryOverCount: sql`${taskTable.carryOverCount} + 1` })
        .where(
          and(
            inArray(taskTable.projectId, activeProjectIds),
            notInArray(taskTable.status, OFF_SPRINT_STATUSES),
          ),
        )
        .returning({ projectId: taskTable.projectId });

      const scored = openGoals.map((goal) => {
        const outcome = outcomes.get(goal.id) as GoalOutcome;
        return {
          ...goal,
          result: outcome.result,
          carryOver: outcome.carryOver,
        };
      });
      for (const goal of scored) {
        await tx
          .update(sprintGoalTable)
          .set({ result: goal.result, sprintId: created.id })
          .where(eq(sprintGoalTable.id, goal.id));
      }
      const carried = scored.filter((goal) => goal.carryOver);
      if (carried.length > 0) {
        await tx.insert(sprintGoalTable).values(
          carried.map((goal) => ({
            workspaceId,
            title: goal.title,
            description: goal.description,
            ownerId: goal.ownerId,
            points: goal.points,
            carriedFromGoalId: goal.id,
            carryOverCount: goal.carryOverCount + 1,
            position: goal.position,
          })),
        );
      }
      const score = goalScore(scored);

      const [sprintWithCounts] = await tx
        .update(sprintTable)
        .set({
          completedCount: archivedRows.length,
          carriedOverCount: carriedRows.length,
          goalPointsEarned: score.earned,
          goalPointsTotal: score.total,
        })
        .where(eq(sprintTable.id, created.id))
        .returning();

      return {
        sprint: sprintWithCounts ?? created,
        archived: archivedRows,
        carriedProjectIds: carriedRows.map((row) => row.projectId),
      };
    },
  );

  if (archived.length > 0) {
    const parentProjects = await getSubtaskParentProjects(
      archived.map((task) => task.id),
    );
    await publishEvent("subtask-parents.refresh", { projects: parentProjects });
  }

  for (const task of archived) {
    await publishEvent("task.status_changed", {
      taskId: task.id,
      projectId: task.projectId,
      userId: currentUserId,
      oldStatus: task.oldStatus,
      newStatus: ARCHIVED_STATUS,
      title: task.title,
      assigneeId: task.userId,
      type: "status_changed",
      skipSubtaskParentRefresh: true,
    });
  }

  // Carried tasks change only their badge; refresh every touched board once.
  const touchedProjects = new Set([
    ...archived.map((task) => task.projectId),
    ...carriedProjectIds,
  ]);
  for (const projectId of touchedProjects) {
    await publishEvent("task-relation.refresh", {
      projectId,
      userId: currentUserId,
    });
  }

  return {
    ...sprint,
    goals: await selectSprintGoals(workspaceId, [sprint.id]),
  };
}

export default closeSprint;
