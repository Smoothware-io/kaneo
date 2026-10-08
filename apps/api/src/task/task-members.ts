import { asc, inArray } from "drizzle-orm";
import type database from "../database";
import { taskMemberTable } from "../database/schema";
import type { TaskReadDatabase } from "./bounded-read";

/** Team member ids per task, in the order they were added. */
export async function getTaskMemberIds(
  db: TaskReadDatabase | typeof database,
  taskIds: string[],
) {
  const members = new Map<string, string[]>();
  if (taskIds.length === 0) return members;

  const rows = await db
    .select({ taskId: taskMemberTable.taskId, userId: taskMemberTable.userId })
    .from(taskMemberTable)
    .where(inArray(taskMemberTable.taskId, taskIds))
    .orderBy(asc(taskMemberTable.createdAt), asc(taskMemberTable.userId));

  for (const row of rows) {
    const ids = members.get(row.taskId) ?? [];
    ids.push(row.userId);
    members.set(row.taskId, ids);
  }
  return members;
}
