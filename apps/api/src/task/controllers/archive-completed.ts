import { and, eq, inArray } from "drizzle-orm";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { getSubtaskParentProjects } from "../get-subtask-parent-projects";
import { ARCHIVED_STATUS, statusDetailsWithoutInput } from "../workflow-guards";

/**
 * Archives every task in a project's final columns in one step, taking it off
 * the board while it stays findable in the backlog's archive. Closing the
 * whole workspace's week is the sprint close, which also records history.
 */
async function archiveCompleted({
  projectId,
  currentUserId,
}: {
  projectId: string;
  currentUserId: string;
}) {
  const finalSlugs = (
    await db
      .select({ slug: columnTable.slug })
      .from(columnTable)
      .where(
        and(
          eq(columnTable.projectId, projectId),
          eq(columnTable.isFinal, true),
        ),
      )
  ).map((column) => column.slug);

  if (finalSlugs.length === 0) {
    return { archivedCount: 0 };
  }

  // Snapshot of the rows being archived, so events carry each old status.
  const closing = db
    .select({ id: taskTable.id, oldStatus: taskTable.status })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.projectId, projectId),
        inArray(taskTable.status, finalSlugs),
      ),
    )
    .as("closing");

  const archived = await db
    .update(taskTable)
    .set({
      status: ARCHIVED_STATUS,
      columnId: null,
      ...statusDetailsWithoutInput(ARCHIVED_STATUS),
    })
    .from(closing)
    .where(eq(taskTable.id, closing.id))
    .returning({
      id: taskTable.id,
      title: taskTable.title,
      userId: taskTable.userId,
      oldStatus: closing.oldStatus,
    });

  if (archived.length === 0) {
    return { archivedCount: 0 };
  }

  const parentProjects = await getSubtaskParentProjects(
    archived.map((task) => task.id),
  );
  await publishEvent("subtask-parents.refresh", { projects: parentProjects });

  for (const task of archived) {
    await publishEvent("task.status_changed", {
      taskId: task.id,
      projectId,
      userId: currentUserId,
      oldStatus: task.oldStatus,
      newStatus: ARCHIVED_STATUS,
      title: task.title,
      assigneeId: task.userId,
      type: "status_changed",
      skipSubtaskParentRefresh: true,
    });
  }

  await publishEvent("task-relation.refresh", {
    projectId,
    userId: currentUserId,
  });

  return { archivedCount: archived.length };
}

export default archiveCompleted;
