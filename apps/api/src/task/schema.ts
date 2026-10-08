import { pagingNumber, z } from "../openapi";
import { MAX_TASK_POSITION } from "./controllers/next-task-position";
import { VALID_PRIORITIES } from "./validate-task-fields";
import { MAX_BLOCKED_REASON_LENGTH } from "./workflow-guards";

export const taskParam = z.object({ id: z.string() });

export const projectIdParam = z.object({ projectId: z.string() });

export const workspaceIdParam = z.object({ workspaceId: z.string() });

const priority = z.enum(VALID_PRIORITIES);

// Only read for the matching target status; ignored and cleared otherwise.
const statusDetailFields = {
  blockedReason: z
    .string()
    .max(MAX_BLOCKED_REASON_LENGTH)
    .nullable()
    .optional()
    .openapi({
      description:
        "Why the task is blocked. Required when entering the `blocked` column; omit to keep the current reason while it stays blocked.",
    }),
  blockedOnUserId: z.string().nullable().optional().openapi({
    description:
      "Workspace member needed to unblock the task. Null clears it; omit to keep the current one.",
  }),
  cancelReason: z
    .string()
    .max(MAX_BLOCKED_REASON_LENGTH)
    .nullable()
    .optional()
    .openapi({
      description:
        "Why the task was cancelled. Required when entering the `cancelled` status.",
    }),
};

// Required object of optional filters: a RouteParameter cannot itself be optional.
export const listTasksQuery = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: z.string().optional(),
  // Number("abc") is NaN, which used to reach the limit/offset clause unchecked.
  page: pagingNumber(1, 1_000_000).optional(),
  relatedPage: pagingNumber(1, 1_000_000).optional(),
  limit: pagingNumber(1, 100).optional(),
  sortBy: z
    .enum(["createdAt", "priority", "dueDate", "position", "title", "number"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  dueBefore: z.string().optional(),
  dueAfter: z.string().optional(),
});

export const bulkUpdateBody = z.object({
  taskIds: z.array(z.string()).min(1),
  operation: z.enum([
    "updateStatus",
    "updatePriority",
    "updateAssignee",
    "delete",
    "addLabel",
    "removeLabel",
    "updateDueDate",
  ]),
  value: z.string().nullable().optional().openapi({
    description:
      "The new value for the chosen operation. Unused by `delete`; null clears an assignee or due date.",
  }),
  reason: z
    .string()
    .max(MAX_BLOCKED_REASON_LENGTH)
    .nullable()
    .optional()
    .openapi({
      description: "Why the tasks are deleted. Required by `delete`.",
    }),
});

export const createTaskBody = z.object({
  title: z.string(),
  description: z.string(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  priority,
  status: z.string().openapi({ description: "The target column's slug." }),
  userId: z.string().optional().openapi({ description: "Assignee, if any." }),
  customFields: z
    .array(z.object({ fieldId: z.string(), value: z.string() }))
    .optional(),
  ...statusDetailFields,
});

export const updateTaskBody = z.object({
  title: z.string(),
  description: z.string().optional().openapi({
    description:
      "Omit to preserve the existing description when updating a list summary.",
  }),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  priority,
  status: z.string(),
  projectId: z.string(),
  position: z.number().int().min(0).max(MAX_TASK_POSITION),
  userId: z.string().optional(),
  ...statusDetailFields,
});

export const moveTaskBody = z.object({
  destinationProjectId: z.string(),
  destinationStatus: z.string().optional().openapi({
    description: "Defaults to the destination project's first column.",
  }),
});

export const importTasksBody = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      status: z.string(),
      priority: z.string().optional(),
      startDate: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
      userId: z.string().nullable().optional(),
      blockedReason: z.string().nullable().optional().openapi({
        description:
          "Required for `blocked` tasks; without it they import as `planned`.",
      }),
      cancelReason: z.string().nullable().optional().openapi({
        description:
          "Required for `cancelled` tasks; without it they import as `planned`.",
      }),
    }),
  ),
});

export const updateStatusBody = z.object({
  status: z.string(),
  ...statusDetailFields,
});
export const updatePriorityBody = z.object({ priority });
export const updateAssigneeBody = z.object({
  userId: z.string().nullable().openapi({ description: "Null unassigns." }),
});
export const updateDueDateBody = z.object({ dueDate: z.string().optional() });
export const updateTitleBody = z.object({ title: z.string() });
export const updateDescriptionBody = z.object({ description: z.string() });

const surface = z.enum(["description", "comment"]).openapi({
  description: "Where the image is used, which decides how it is scoped.",
});

export const imageUploadBody = z.object({
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  surface,
});

export const finalizeImageUploadBody = z.object({
  key: z
    .string()
    .openapi({ description: "The key returned when the URL was issued." }),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  surface,
});

export const descriptionPageQuery = z.object({
  offset: pagingNumber(0, 2_000_000_000, 0),
  version: z
    .string()
    .regex(/^[0-9]{1,10}$/)
    .optional(),
});
export const descriptionMatchesQuery = z.object({
  query: z.string().trim().min(1).max(256),
  after: z.string().min(1).max(128).optional(),
});

export const duplicateTaskBody = z.object({ title: z.string().optional() });

export const deleteTaskBody = z.object({
  reason: z.string().max(MAX_BLOCKED_REASON_LENGTH).openapi({
    description: "Why the task is deleted. Kept in the project's deletion log.",
  }),
});

export const updateMembersBody = z.object({
  userIds: z.array(z.string()).max(50).openapi({
    description:
      "The full set of team members. Replaces the current members; the responsible assignee is set separately.",
  }),
});
