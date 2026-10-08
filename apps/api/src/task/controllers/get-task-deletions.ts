import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { taskDeletionTable, userTable } from "../../database/schema";

const MAX_DELETIONS = 200;

/** The most recent deletions in a project, with who deleted them and why. */
async function getTaskDeletions(projectId: string) {
  return db
    .select({
      id: taskDeletionTable.id,
      taskId: taskDeletionTable.taskId,
      taskNumber: taskDeletionTable.taskNumber,
      title: taskDeletionTable.title,
      reason: taskDeletionTable.reason,
      deletedById: taskDeletionTable.deletedById,
      deletedByName: userTable.name,
      deletedAt: taskDeletionTable.deletedAt,
    })
    .from(taskDeletionTable)
    .leftJoin(userTable, eq(taskDeletionTable.deletedById, userTable.id))
    .where(eq(taskDeletionTable.projectId, projectId))
    .orderBy(desc(taskDeletionTable.deletedAt))
    .limit(MAX_DELETIONS);
}

export default getTaskDeletions;
