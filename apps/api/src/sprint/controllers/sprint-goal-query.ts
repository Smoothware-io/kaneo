import { and, asc, eq, inArray, isNull, type SQL } from "drizzle-orm";
import db from "../../database";
import { sprintGoalTable, userTable } from "../../database/schema";

export const sprintGoalColumns = {
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
  position: sprintGoalTable.position,
  createdAt: sprintGoalTable.createdAt,
  updatedAt: sprintGoalTable.updatedAt,
};

function selectGoals(where: SQL | undefined) {
  return db
    .select(sprintGoalColumns)
    .from(sprintGoalTable)
    .leftJoin(userTable, eq(sprintGoalTable.ownerId, userTable.id))
    .where(where)
    .orderBy(asc(sprintGoalTable.position), asc(sprintGoalTable.createdAt));
}

export function selectOpenGoals(workspaceId: string) {
  return selectGoals(
    and(
      eq(sprintGoalTable.workspaceId, workspaceId),
      isNull(sprintGoalTable.sprintId),
    ),
  );
}

export function selectSprintGoals(workspaceId: string, sprintIds: string[]) {
  if (sprintIds.length === 0) return Promise.resolve([]);
  return selectGoals(
    and(
      eq(sprintGoalTable.workspaceId, workspaceId),
      inArray(sprintGoalTable.sprintId, sprintIds),
    ),
  );
}

export async function selectGoal(id: string) {
  const [goal] = await selectGoals(eq(sprintGoalTable.id, id));
  return goal;
}
