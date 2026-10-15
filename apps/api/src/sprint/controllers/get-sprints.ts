import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { sprintTable, userTable } from "../../database/schema";
import { selectSprintGoals } from "./sprint-goal-query";

// A year of weekly sprints.
const MAX_SPRINTS = 52;

/** Closed sprints, newest first, with who closed each one and its goals. */
async function getSprints(workspaceId: string) {
  const sprints = await db
    .select({
      id: sprintTable.id,
      weekYear: sprintTable.weekYear,
      week: sprintTable.week,
      closedAt: sprintTable.closedAt,
      closedById: sprintTable.closedById,
      closedByName: userTable.name,
      completedCount: sprintTable.completedCount,
      carriedOverCount: sprintTable.carriedOverCount,
      goalPointsEarned: sprintTable.goalPointsEarned,
      goalPointsTotal: sprintTable.goalPointsTotal,
    })
    .from(sprintTable)
    .leftJoin(userTable, eq(sprintTable.closedById, userTable.id))
    .where(eq(sprintTable.workspaceId, workspaceId))
    .orderBy(desc(sprintTable.closedAt))
    .limit(MAX_SPRINTS);

  const goals = await selectSprintGoals(
    workspaceId,
    sprints.map((sprint) => sprint.id),
  );
  return sprints.map((sprint) => ({
    ...sprint,
    goals: goals.filter((goal) => goal.sprintId === sprint.id),
  }));
}

export default getSprints;
