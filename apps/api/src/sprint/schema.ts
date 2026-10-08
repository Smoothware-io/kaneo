import { z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const sprintParam = z.object({
  workspaceId: z.string(),
  sprintId: z.string(),
});
