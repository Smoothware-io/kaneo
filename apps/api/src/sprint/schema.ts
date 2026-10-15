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

export const createSprintGoalBody = z.object({
  title: goalTitle,
  description: goalDescription.optional(),
  ownerId: z.string().nullable().optional(),
  points: goalPoints.optional(),
});

export const updateSprintGoalBody = z.object({
  title: goalTitle.optional(),
  description: goalDescription.optional(),
  ownerId: z.string().nullable().optional(),
  points: goalPoints.optional(),
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
