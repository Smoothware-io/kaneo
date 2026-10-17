import { responseTimestamp, z } from "../openapi";

export const sprintGoalTaskSchema = z
  .object({
    id: z.string(),
    number: z.number().nullable(),
    title: z.string(),
    status: z.string(),
    projectId: z.string(),
    projectName: z.string(),
    projectSlug: z.string(),
    userId: z.string().nullable(),
    assigneeName: z.string().nullable(),
    done: z.boolean().openapi({
      description: "In a final column, or archived by a sprint close.",
    }),
  })
  .openapi("SprintGoalTask");

export const sprintGoalSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    ownerId: z.string().nullable(),
    ownerName: z.string().nullable(),
    points: z.number().int(),
    result: z.enum(["fully", "half", "none"]).nullable().openapi({
      description: "Null while the goal is in the open sprint.",
    }),
    sprintId: z.string().nullable().openapi({
      description: "The sprint that closed this goal; null while open.",
    }),
    carriedFromGoalId: z.string().nullable(),
    carryOverCount: z.number().int().nonnegative().openapi({
      description: "How many sprints this goal was taken into unreached.",
    }),
    repeatWeekly: z.boolean(),
    position: z.number().int(),
    tasks: z.array(sprintGoalTaskSchema).openapi({
      description: "Linked tasks, unfinished first.",
    }),
    taskCount: z.number().int().nonnegative(),
    doneTaskCount: z.number().int().nonnegative(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("SprintGoal");

export const sprintGoalListSchema = z.array(sprintGoalSchema);

export const sprintSchema = z
  .object({
    id: z.string(),
    weekYear: z.number().int(),
    week: z.number().int().openapi({
      description: "ISO week number of the moment the sprint was closed.",
    }),
    closedAt: responseTimestamp,
    closedById: z.string().nullable(),
    closedByName: z.string().nullable().optional(),
    completedCount: z.number().int().nonnegative().openapi({
      description: "Finished tasks archived by this close.",
    }),
    carriedOverCount: z.number().int().nonnegative().openapi({
      description: "Unfinished tasks that rolled over into the next week.",
    }),
    goalPointsEarned: z.number().nonnegative().openapi({
      description: "Goal points earned: fully counts all, half counts half.",
    }),
    goalPointsTotal: z.number().int().nonnegative().openapi({
      description: "Points of every goal the sprint closed.",
    }),
    goals: sprintGoalListSchema.openapi({
      description: "The goals this sprint closed, with their results.",
    }),
  })
  .openapi("Sprint");

export const sprintListSchema = z.array(sprintSchema);

export const sprintTaskSchema = z
  .object({
    id: z.string(),
    number: z.number().nullable(),
    title: z.string(),
    status: z.string(),
    projectId: z.string(),
    projectName: z.string(),
    projectSlug: z.string(),
    userId: z.string().nullable(),
    assigneeName: z.string().nullable(),
    carryOverCount: z.number().int().nonnegative(),
  })
  .openapi("SprintTask");

export const sprintTaskListSchema = z.array(sprintTaskSchema);
