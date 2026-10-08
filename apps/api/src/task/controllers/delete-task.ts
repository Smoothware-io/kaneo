import { eq, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  taskDeletionTable,
  taskRelationTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { deleteS3Keys, getTaskAssetKeys } from "../../storage/cleanup-assets";
import { normalizeReason } from "../workflow-guards";
import getTask from "./get-task";

export function requireDeletionReason(reason: string | null | undefined) {
  const normalized = normalizeReason(reason, "deletion reason");
  if (!normalized) {
    throw new HTTPException(400, {
      message: "A reason is required to delete a task.",
    });
  }
  return normalized;
}

export function deletionLogEntry(
  task: { id: string; projectId: string; number: number | null; title: string },
  reason: string,
  deletedById: string,
) {
  return {
    projectId: task.projectId,
    taskId: task.id,
    taskNumber: task.number,
    title: task.title,
    reason,
    deletedById,
  };
}

async function deleteTask(
  taskId: string,
  currentUserId: string,
  reason: string | null | undefined,
) {
  const deletionReason = requireDeletionReason(reason);
  const task = await getTask(taskId);

  const relations = await db
    .select()
    .from(taskRelationTable)
    .where(
      or(
        eq(taskRelationTable.sourceTaskId, taskId),
        eq(taskRelationTable.targetTaskId, taskId),
      ),
    )
    .execute();

  const assetKeys = await getTaskAssetKeys(taskId);

  const deletedTask = await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(taskTable)
      .where(eq(taskTable.id, taskId))
      .returning();
    if (deleted) {
      await tx
        .insert(taskDeletionTable)
        .values(deletionLogEntry(deleted, deletionReason, currentUserId));
    }
    return deleted;
  });

  if (!deletedTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  await publishEvent("task.deleted", {
    taskId: task.id,
    projectId: task.projectId,
    userId: currentUserId,
    title: task.title,
  });

  for (const relation of relations) {
    await publishEvent("task-relation.deleted", {
      projectId: task.projectId,
      userId: currentUserId,
      taskId: taskId,
      sourceTaskId: relation.sourceTaskId,
      targetTaskId: relation.targetTaskId,
    });
  }

  // Fire-and-forget S3 cleanup after successful DB delete
  if (assetKeys.length > 0) {
    deleteS3Keys(assetKeys).catch(() => {});
  }

  return task;
}

export default deleteTask;
