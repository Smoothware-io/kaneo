import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { deleteOrphanedAssets } from "../../storage/cleanup-assets";
import {
  assertAssignableUser,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";
import { boardDescription, descriptionDeferred } from "../description-pages";
import { assertValidTaskStatus } from "../validate-task-fields";
import {
  assertInProgressCapacity,
  entersInProgressFor,
  publishBlockedOnUser,
  resolveStatusDetails,
  type StatusDetailsInput,
} from "../workflow-guards";
import { assertTaskPosition } from "./next-task-position";

async function updateTask(
  id: string,
  title: string,
  status: string,
  startDate: Date | undefined,
  dueDate: Date | undefined,
  projectId: string,
  description: string | undefined,
  priority: string,
  position: number,
  userId?: string,
  currentUserId?: string,
  details: StatusDetailsInput = {},
) {
  assertTaskPosition(position);

  const [existingTask] = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      priority: taskTable.priority,
      description:
        description === undefined ? sql<null>`null` : taskTable.description,
      status: taskTable.status,
      projectId: taskTable.projectId,
      userId: taskTable.userId,
      blockedReason: taskTable.blockedReason,
      blockedOnUserId: taskTable.blockedOnUserId,
      cancelReason: taskTable.cancelReason,
      archivedAt: taskTable.archivedAt,
    })
    .from(taskTable)
    .where(eq(taskTable.id, id))
    .limit(1);

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  if (projectId !== existingTask.projectId) {
    throw new HTTPException(400, {
      message: "Use the task move endpoint to move tasks between projects",
    });
  }

  await assertValidTaskStatus(status, projectId);

  const normalizedUserId = userId?.trim() || undefined;
  const workspaceId = await getProjectWorkspaceId(projectId);

  if (normalizedUserId) {
    await assertAssignableUser(normalizedUserId, workspaceId);
  }

  const statusDetails = await resolveStatusDetails({
    workspaceId,
    previous: existingTask,
    nextStatus: status,
    input: details,
  });

  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, projectId),
      eq(columnTable.slug, status),
    ),
  });

  const updatedTask = await db.transaction(async (tx) => {
    const startingFor = entersInProgressFor(existingTask, {
      status,
      userId: normalizedUserId ?? null,
    });
    if (startingFor) {
      await assertInProgressCapacity(tx, workspaceId, [
        { userId: startingFor, taskId: id },
      ]);
    }

    const [task] = await tx
      .update(taskTable)
      .set({
        title,
        status,
        columnId: column?.id ?? null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        projectId,
        description,
        priority,
        position,
        userId: normalizedUserId ?? null,
        ...statusDetails,
      })
      .where(eq(taskTable.id, id))
      .returning({
        ...getTableColumns(taskTable),
        description: boardDescription,
        descriptionDeferred,
      });
    return task;
  });

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task",
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
  }

  if (existingTask.title !== title) {
    await publishEvent("task.title_changed", {
      taskId: updatedTask.id,
      projectId: updatedTask.projectId,
      userId: currentUserId,
      oldTitle: existingTask.title,
      newTitle: title,
      type: "title_changed",
    });
  }

  if (description !== undefined && existingTask.description !== description) {
    await publishEvent("task.description_changed", {
      taskId: updatedTask.id,
      projectId: updatedTask.projectId,
      userId: currentUserId,
      oldDescription: existingTask.description,
      newDescription: description,
      type: "description_changed",
    });
  }

  if (existingTask.priority !== priority) {
    await publishEvent("task.priority_changed", {
      taskId: updatedTask.id,
      projectId: updatedTask.projectId,
      userId: currentUserId,
      oldPriority: existingTask.priority,
      newPriority: priority,
      title: updatedTask.title,
      type: "priority_changed",
    });
  }

  await publishBlockedOnUser(existingTask, updatedTask, currentUserId);

  await publishEvent("task.updated", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    title: updatedTask.title,
    status: updatedTask.status,
    userId: currentUserId,
  });

  if (description !== undefined && existingTask.description !== description) {
    deleteOrphanedAssets(existingTask.description, description, {
      taskId: id,
    }).catch(() => {});
  }

  return updatedTask;
}

export default updateTask;
