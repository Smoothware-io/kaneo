import { z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const sprintParam = z.object({
  workspaceId: z.string(),
  sprintId: z.string(),
});

export const sprintGoalParam = z.object({
  workspaceId: z.string(),
  goalId: z.string(),
});

const goalTitle = z.string().trim().min(1).max(200);
const goalDescription = z.string().max(2000).nullable();
const goalPoints = z.number().int().min(1).max(100).openapi({
  description: "What the goal is worth; half a result earns half of it.",
});

const repeatWeekly = z.boolean().openapi({
  description:
    "Re-create the goal fresh (same title and points, no tickets) for every next sprint.",
});

const goalTaskIds = z.array(z.string()).max(100);

export const sprintGoalTaskParam = z.object({
  workspaceId: z.string(),
  goalId: z.string(),
  taskId: z.string(),
});

export const createSprintGoalBody = z.object({
  title: goalTitle,
  description: goalDescription.optional(),
  ownerId: z.string().nullable().optional(),
  points: goalPoints.optional(),
  repeatWeekly: repeatWeekly.optional(),
  taskIds: goalTaskIds.optional().openapi({
    description: "Tasks that must be finished to reach the goal.",
  }),
});

export const updateSprintGoalBody = z.object({
  title: goalTitle.optional(),
  description: goalDescription.optional(),
  ownerId: z.string().nullable().optional(),
  points: goalPoints.optional(),
  repeatWeekly: repeatWeekly.optional(),
});

export const linkSprintGoalTasksBody = z.object({
  taskIds: goalTaskIds.min(1).openapi({
    description: "Tasks to link; ones already linked are left as they are.",
  }),
});

export const reorderSprintGoalsBody = z.object({
  goalIds: z.array(z.string()).min(1).openapi({
    description: "Every open goal's ID, in the new order.",
  }),
});

export const closeSprintBody = z.object({
  goals: z
    .array(
      z.object({
        goalId: z.string(),
        result: z.enum(["fully", "half", "none"]).openapi({
          description:
            "fully earns the goal's points, half earns half of them, none earns nothing.",
        }),
        carryOver: z.boolean().openapi({
          description: "Copy the goal into the next sprint as a fresh goal.",
        }),
      }),
    )
    .default([])
    .openapi({ description: "A result for every open goal." }),
});
