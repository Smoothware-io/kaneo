import { requireEntitlement } from "../billing/require-entitlement-middleware";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { getSprintBoard } from "../task/controllers/get-my-tasks";
import { boardSchema } from "../task/response";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import closeSprint from "./controllers/close-sprint";
import getSprintTasks from "./controllers/get-sprint-tasks";
import getSprints from "./controllers/get-sprints";
import {
  sprintListSchema,
  sprintSchema,
  sprintTaskListSchema,
} from "./response";
import { sprintParam, workspaceIdParam } from "./schema";

const getSprintBoardRoute = createRoute({
  method: "get",
  operationId: "getSprintBoard",
  path: "/board/{workspaceId}",
  tags: ["Sprints"],
  summary: "Get the sprint board",
  description:
    "Every open task across the workspace's active projects, grouped into the shared status columns. Backlog, archived and cancelled tasks are left out.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("The sprint board", boardSchema),
    403: errorResponse("No access to the workspace"),
    503: errorResponse("Sprint board request timed out"),
  },
});

const closeSprintRoute = createRoute({
  method: "post",
  operationId: "closeSprint",
  path: "/close/{workspaceId}",
  tags: ["Sprints"],
  summary: "Close the sprint",
  description:
    "Close the week for the whole workspace: finished tasks in every active project are archived under this sprint, and unfinished tasks stay with their carry-over count raised by one.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ workspace: ["update", "manage_settings"] }),
    requireEntitlement,
  ] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("The closed sprint", sprintSchema),
    403: errorResponse(
      "No workspace access, or missing workspace:update and workspace:manage_settings permission",
    ),
  },
});

const listSprintsRoute = createRoute({
  method: "get",
  operationId: "listSprints",
  path: "/history/{workspaceId}",
  tags: ["Sprints"],
  summary: "List closed sprints",
  description: "The workspace's closed sprints, newest first (up to 52).",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Closed sprints", sprintListSchema),
    403: errorResponse("No access to the workspace"),
  },
});

const listSprintTasksRoute = createRoute({
  method: "get",
  operationId: "listSprintTasks",
  path: "/history/{workspaceId}/{sprintId}",
  tags: ["Sprints"],
  summary: "List tasks finished in a sprint",
  description: "The tasks a closed sprint archived as finished.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: sprintParam },
  responses: {
    200: jsonResponse("Finished tasks", sprintTaskListSchema),
    403: errorResponse("No access to the workspace"),
    404: errorResponse("Sprint not found"),
  },
});

const sprint = apiRouter()
  .openapi(getSprintBoardRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(await getSprintBoard(workspaceId), 200);
  })
  .openapi(closeSprintRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const closed = await closeSprint({
      workspaceId,
      currentUserId: c.get("userId"),
    });
    return c.json(closed, 200);
  })
  .openapi(listSprintsRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(await getSprints(workspaceId), 200);
  })
  .openapi(listSprintTasksRoute, async (c) => {
    const { workspaceId, sprintId } = c.req.valid("param");
    return c.json(await getSprintTasks(workspaceId, sprintId), 200);
  });

export default sprint;
