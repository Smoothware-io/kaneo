import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { filterAssignableUsers } from "../../utils/assert-assignable-user";
import {
  coercePriority,
  coerceStatus,
  getValidTaskStatuses,
} from "../validate-task-fields";
import {
  ARCHIVED_STATUS,
  assertInProgressCapacity,
  BLOCKED_STATUS,
  CANCELLED_STATUS,
  entersInProgressFor,
  MAX_BLOCKED_REASON_LENGTH,
} from "../workflow-guards";
import { claimTaskNumber } from "./claim-task-numbers";

export type ImportTask = {
  title: string;
  description?: string;
  status: string;
  priority?: string;
  startDate?: string | null;
  dueDate?: string | null;
  userId?: string | null;
  blockedReason?: string | null;
  cancelReason?: string | null;
};

async function importTasks(
  projectId: string,
  tasksToImport: ImportTask[],
  currentUserId?: string,
) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  const assigneeIds = [
    ...new Set(
      tasksToImport
        .map((task) => task.userId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const assignableIds = await filterAssignableUsers(
    assigneeIds,
    project.workspaceId,
  );

  const validStatuses = await getValidTaskStatuses(projectId);

  const results = [];

  for (const taskData of tasksToImport) {
    const assigneeId = taskData.userId?.trim() || null;

    if (assigneeId && !assignableIds.has(assigneeId)) {
      results.push({
        success: false,
        error: "Assignee is not a member of this workspace",
        task: taskData,
      });
      continue;
    }

    try {
      const coerced = coerceStatus(taskData.status, validStatuses);
      const blockedReason =
        taskData.blockedReason?.trim().slice(0, MAX_BLOCKED_REASON_LENGTH) ||
        null;
      const cancelReason =
        taskData.cancelReason?.trim().slice(0, MAX_BLOCKED_REASON_LENGTH) ||
        null;
      // A blocked or cancelled task without its reason would break the
      // status contract, so it lands in planned instead.
      const missingReason =
        (coerced.status === BLOCKED_STATUS && !blockedReason) ||
        (coerced.status === CANCELLED_STATUS && !cancelReason);
      const { status, warning: statusWarning } = missingReason
        ? {
            status: "planned",
            warning: `Status "${coerced.status}" needs a reason and was mapped to "planned"`,
          }
        : coerced;
      const { priority, warning: priorityWarning } = coercePriority(
        taskData.priority || "low",
      );
      const warnings = [statusWarning, priorityWarning].filter(Boolean);

      const column = await db.query.columnTable.findFirst({
        where: and(
          eq(columnTable.projectId, projectId),
          eq(columnTable.slug, status),
        ),
      });

      const createdTask = await db.transaction(async (tx) => {
        const startingFor = entersInProgressFor(null, {
          status,
          userId: assigneeId,
        });
        if (startingFor) {
          await assertInProgressCapacity(tx, project.workspaceId, [
            { userId: startingFor },
          ]);
        }

        const taskNumber = await claimTaskNumber(projectId, tx);

        const [task] = await tx
          .insert(taskTable)
          .values({
            projectId,
            userId: assigneeId,
            title: taskData.title,
            status,
            columnId: column?.id ?? null,
            startDate: taskData.startDate ? new Date(taskData.startDate) : null,
            dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
            description: taskData.description || "",
            priority,
            blockedReason: status === BLOCKED_STATUS ? blockedReason : null,
            cancelReason: status === CANCELLED_STATUS ? cancelReason : null,
            archivedAt: status === ARCHIVED_STATUS ? new Date() : null,
            number: taskNumber,
          })
          .returning();

        return task;
      });

      if (createdTask) {
        await publishEvent("task.created", {
          ...createdTask,
          taskId: createdTask.id,
          userId: createdTask.userId ?? "",
          currentUserId: currentUserId ?? "",
          type: "create",
          content: "imported the task",
        });

        results.push({
          success: true,
          task: createdTask,
          ...(warnings.length > 0 && { warnings }),
        });
      } else {
        results.push({
          success: false,
          error: "Failed to create task",
          task: taskData,
        });
      }
    } catch (error) {
      // A full in-progress slot fails only that row, not the whole import.
      if (error instanceof HTTPException && error.status !== 409) {
        throw error;
      }
      results.push({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        task: taskData,
      });
    }
  }

  return {
    importedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
    },
    results: {
      total: tasksToImport.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      tasks: results,
    },
  };
}

export default importTasks;
