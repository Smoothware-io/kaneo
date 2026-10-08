import { responseTimestamp, z } from "../openapi";

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
