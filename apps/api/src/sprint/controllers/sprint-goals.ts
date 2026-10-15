import { and, eq, isNull, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintGoalTable, workspaceUserTable } from "../../database/schema";
import { selectGoal, selectOpenGoals } from "./sprint-goal-query";

type GoalFields = {
  title?: string;
  description?: string | null;
  ownerId?: string | null;
  points?: number;
};

async function assertGoalOwner(workspaceId: string, ownerId: string) {
  const [member] = await db
    .select({ id: workspaceUserTable.id })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, ownerId),
      ),
    )
    .limit(1);
  if (!member) {
    throw new HTTPException(400, {
      message: "Goal owner must be a current workspace member",
    });
  }
}

// Closed goals are history: only goals in the open sprint can change.
async function findOpenGoal(workspaceId: string, goalId: string) {
  const [goal] = await db
    .select({ id: sprintGoalTable.id })
    .from(sprintGoalTable)
    .where(
      and(
        eq(sprintGoalTable.id, goalId),
        eq(sprintGoalTable.workspaceId, workspaceId),
        isNull(sprintGoalTable.sprintId),
      ),
    )
    .limit(1);
  if (!goal) {
    throw new HTTPException(404, { message: "Open sprint goal not found" });
  }
  return goal;
}

export function getSprintGoals(workspaceId: string) {
  return selectOpenGoals(workspaceId);
}

export async function createSprintGoal(
  workspaceId: string,
  fields: GoalFields & { title: string },
) {
  if (fields.ownerId) await assertGoalOwner(workspaceId, fields.ownerId);

  const [last] = await db
    .select({ position: max(sprintGoalTable.position) })
    .from(sprintGoalTable)
    .where(
      and(
        eq(sprintGoalTable.workspaceId, workspaceId),
        isNull(sprintGoalTable.sprintId),
      ),
    );

  const [created] = await db
    .insert(sprintGoalTable)
    .values({
      workspaceId,
      title: fields.title,
      description: fields.description ?? null,
      ownerId: fields.ownerId ?? null,
      points: fields.points ?? 1,
      position: (last?.position ?? -1) + 1,
    })
    .returning({ id: sprintGoalTable.id });
  if (!created) throw new Error("Failed to create the sprint goal");

  return selectGoal(created.id);
}

export async function updateSprintGoal(
  workspaceId: string,
  goalId: string,
  fields: GoalFields,
) {
  await findOpenGoal(workspaceId, goalId);
  if (fields.ownerId) await assertGoalOwner(workspaceId, fields.ownerId);

  await db
    .update(sprintGoalTable)
    .set({
      title: fields.title,
      description: fields.description,
      ownerId: fields.ownerId,
      points: fields.points,
    })
    .where(eq(sprintGoalTable.id, goalId));

  return selectGoal(goalId);
}

export async function deleteSprintGoal(workspaceId: string, goalId: string) {
  await findOpenGoal(workspaceId, goalId);
  const goal = await selectGoal(goalId);
  await db.delete(sprintGoalTable).where(eq(sprintGoalTable.id, goalId));
  return goal;
}

export async function reorderSprintGoals(
  workspaceId: string,
  goalIds: string[],
) {
  await db.transaction(async (tx) => {
    const open = await tx
      .select({ id: sprintGoalTable.id })
      .from(sprintGoalTable)
      .where(
        and(
          eq(sprintGoalTable.workspaceId, workspaceId),
          isNull(sprintGoalTable.sprintId),
        ),
      );
    const openIds = new Set(open.map((goal) => goal.id));
    if (
      goalIds.length !== openIds.size ||
      new Set(goalIds).size !== goalIds.length ||
      goalIds.some((id) => !openIds.has(id))
    ) {
      throw new HTTPException(400, {
        message: "goalIds must list every open sprint goal exactly once",
      });
    }
    for (const [position, id] of goalIds.entries()) {
      await tx
        .update(sprintGoalTable)
        .set({ position })
        .where(eq(sprintGoalTable.id, id));
    }
  });

  return selectOpenGoals(workspaceId);
}
