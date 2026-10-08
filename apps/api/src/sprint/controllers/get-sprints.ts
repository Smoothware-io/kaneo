import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { sprintTable, userTable } from "../../database/schema";

// A year of weekly sprints.
const MAX_SPRINTS = 52;

/** Closed sprints, newest first, with who closed each one. */
async function getSprints(workspaceId: string) {
  return db
    .select({
      id: sprintTable.id,
      weekYear: sprintTable.weekYear,
      week: sprintTable.week,
      closedAt: sprintTable.closedAt,
      closedById: sprintTable.closedById,
      closedByName: userTable.name,
      completedCount: sprintTable.completedCount,
      carriedOverCount: sprintTable.carriedOverCount,
    })
    .from(sprintTable)
    .leftJoin(userTable, eq(sprintTable.closedById, userTable.id))
    .where(eq(sprintTable.workspaceId, workspaceId))
    .orderBy(desc(sprintTable.closedAt))
    .limit(MAX_SPRINTS);
}

export default getSprints;
