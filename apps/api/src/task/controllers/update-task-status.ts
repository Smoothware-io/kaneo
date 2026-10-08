import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { getProjectWorkspaceId } from "../../utils/assert-assignable-user";
import { assertValidTaskStatus } from "../validate-task-fields";
import {
  assertInProgressCapacity,
  entersInProgressFor,
  publishBlockedOnUser,
  resolveStatusDetails,
  type StatusDetailsInput,
} from "../workflow-guards";

async function updateTaskStatus({
  id,
  status,
  currentUserId,
  details = {},
}: {
  id: string;
  status: string;
  currentUserId: string;
  details?: StatusDetailsInput;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  await assertValidTaskStatus(status, existingTask.projectId);

  const workspaceId = await getProjectWorkspaceId(existingTask.projectId);
  const statusDetails = await resolveStatusDetails({
    workspaceId,
    previous: existingTask,
    nextStatus: status,
    input: details,
  });

  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, existingTask.projectId),
      eq(columnTable.slug, status),
    ),
  });

  const updatedTask = await db.transaction(async (tx) => {
    const startingFor = entersInProgressFor(existingTask, {
      status,
      userId: existingTask.userId,
    });
    if (startingFor) {
      await assertInProgressCapacity(tx, workspaceId, [
        { userId: startingFor, taskId: id },
      ]);
    }

    const [task] = await tx
      .update(taskTable)
      .set({ status, columnId: column?.id ?? null, ...statusDetails })
      .where(eq(taskTable.id, id))
      .returning();
    return task;
  });

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task status",
    });
  }

  if (existingTask.status !== status) {
    await publishEvent("task.status_changed", {
      taskId: updatedTask.id,
      projectId: updatedTask.projectId,
      userId: currentUserId,
      oldStatus: existingTask.status,
      newStatus: status,
      title: updatedTask.title,
      assigneeId: updatedTask.userId,
      type: "status_changed",
    });

    await publishEvent("task-relation.refresh", {
      projectId: updatedTask.projectId,
      userId: currentUserId,
    });
  } else {
    await publishEvent("task.updated", {
      taskId: updatedTask.id,
      projectId: updatedTask.projectId,
      title: updatedTask.title,
      status: updatedTask.status,
      userId: currentUserId,
    });
  }

  await publishBlockedOnUser(existingTask, updatedTask, currentUserId);

  return updatedTask;
}

export default updateTaskStatus;
