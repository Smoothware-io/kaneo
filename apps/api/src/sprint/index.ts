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
  createSprintGoal,
  deleteSprintGoal,
  getSprintGoals,
  linkSprintGoalTasks,
  reorderSprintGoals,
  unlinkSprintGoalTask,
  updateSprintGoal,
} from "./controllers/sprint-goals";
import {
  sprintGoalListSchema,
  sprintGoalSchema,
  sprintListSchema,
  sprintSchema,
  sprintTaskListSchema,
} from "./response";
import {
  closeSprintBody,
  createSprintGoalBody,
  linkSprintGoalTasksBody,
  reorderSprintGoalsBody,
  sprintGoalParam,
  sprintGoalTaskParam,
  sprintParam,
  updateSprintGoalBody,
  workspaceIdParam,
} from "./schema";

// Goals are team planning, so anyone who can work on tasks can shape them.
const goalWritePermission = { task: ["update"] };

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
    "Close the week for the whole workspace: finished tasks in every active project are archived under this sprint, and unfinished tasks stay with their carry-over count raised by one. Every open goal must be given a result (fully, half or none); goals with carryOver are copied into the next sprint as fresh goals. The body may be omitted when there are no open goals.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ workspace: ["update", "manage_settings"] }),
    requireEntitlement,
  ] as const,
  request: {
    params: workspaceIdParam,
    body: {
      required: false,
      content: { "application/json": { schema: closeSprintBody } },
    },
  },
  responses: {
    200: jsonResponse("The closed sprint", sprintSchema),
    400: errorResponse("An open goal has no result, or a result is invalid"),
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
  description:
    "The workspace's closed sprints, newest first (up to 52), each with its goal score and goals.",
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

const listSprintGoalsRoute = createRoute({
  method: "get",
  operationId: "listSprintGoals",
  path: "/goals/{workspaceId}",
  tags: ["Sprints"],
  summary: "List the open sprint's goals",
  description: "Goals of the running sprint, in display order.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Open sprint goals", sprintGoalListSchema),
    403: errorResponse("No access to the workspace"),
  },
});

const createSprintGoalRoute = createRoute({
  method: "post",
  operationId: "createSprintGoal",
  path: "/goals/{workspaceId}",
  tags: ["Sprints"],
  summary: "Create a sprint goal",
  description: "Add a goal to the running sprint, placed last.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission(goalWritePermission),
  ] as const,
  request: {
    params: workspaceIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createSprintGoalBody } },
    },
  },
  responses: {
    200: jsonResponse("The created goal", sprintGoalSchema),
    400: errorResponse("The owner is not a workspace member"),
    403: errorResponse("No workspace access, or missing task:update"),
  },
});

const reorderSprintGoalsRoute = createRoute({
  method: "put",
  operationId: "reorderSprintGoals",
  path: "/goals/{workspaceId}/order",
  tags: ["Sprints"],
  summary: "Reorder sprint goals",
  description: "Set the display order of every open goal.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission(goalWritePermission),
  ] as const,
  request: {
    params: workspaceIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: reorderSprintGoalsBody } },
    },
  },
  responses: {
    200: jsonResponse("Open goals in their new order", sprintGoalListSchema),
    400: errorResponse("goalIds does not list every open goal exactly once"),
    403: errorResponse("No workspace access, or missing task:update"),
  },
});

const updateSprintGoalRoute = createRoute({
  method: "put",
  operationId: "updateSprintGoal",
  path: "/goals/{workspaceId}/{goalId}",
  tags: ["Sprints"],
  summary: "Update a sprint goal",
  description:
    "Change an open goal; only the fields sent are updated. Closed goals are history and cannot change.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission(goalWritePermission),
  ] as const,
  request: {
    params: sprintGoalParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateSprintGoalBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated goal", sprintGoalSchema),
    400: errorResponse("The owner is not a workspace member"),
    403: errorResponse("No workspace access, or missing task:update"),
    404: errorResponse("Open sprint goal not found"),
  },
});

const deleteSprintGoalRoute = createRoute({
  method: "delete",
  operationId: "deleteSprintGoal",
  path: "/goals/{workspaceId}/{goalId}",
  tags: ["Sprints"],
  summary: "Delete a sprint goal",
  description: "Remove a goal from the running sprint.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission(goalWritePermission),
  ] as const,
  request: { params: sprintGoalParam },
  responses: {
    200: jsonResponse("The deleted goal", sprintGoalSchema),
    403: errorResponse("No workspace access, or missing task:update"),
    404: errorResponse("Open sprint goal not found"),
  },
});

const linkSprintGoalTasksRoute = createRoute({
  method: "post",
  operationId: "linkSprintGoalTasks",
  path: "/goals/{workspaceId}/{goalId}/tasks",
  tags: ["Sprints"],
  summary: "Link tasks to a sprint goal",
  description:
    "Link the tasks that must be finished to reach an open goal. A task can belong to several goals.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission(goalWritePermission),
  ] as const,
  request: {
    params: sprintGoalParam,
    body: {
      required: true,
      content: { "application/json": { schema: linkSprintGoalTasksBody } },
    },
  },
  responses: {
    200: jsonResponse("The goal with its linked tasks", sprintGoalSchema),
    400: errorResponse("A task is not in this workspace"),
    403: errorResponse("No workspace access, or missing task:update"),
    404: errorResponse("Open sprint goal not found"),
  },
});

const unlinkSprintGoalTaskRoute = createRoute({
  method: "delete",
  operationId: "unlinkSprintGoalTask",
  path: "/goals/{workspaceId}/{goalId}/tasks/{taskId}",
  tags: ["Sprints"],
  summary: "Unlink a task from a sprint goal",
  description: "Remove a task from an open goal. The task itself is kept.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission(goalWritePermission),
  ] as const,
  request: { params: sprintGoalTaskParam },
  responses: {
    200: jsonResponse("The goal with its linked tasks", sprintGoalSchema),
    403: errorResponse("No workspace access, or missing task:update"),
    404: errorResponse("Open sprint goal not found"),
  },
});

const sprint = apiRouter()
  .openapi(getSprintBoardRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(await getSprintBoard(workspaceId), 200);
  })
  .openapi(closeSprintRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const body = c.req.valid("json");
    const closed = await closeSprint({
      workspaceId,
      currentUserId: c.get("userId"),
      goals: body?.goals,
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
  })
  .openapi(listSprintGoalsRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(await getSprintGoals(workspaceId), 200);
  })
  .openapi(createSprintGoalRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(
      await createSprintGoal(workspaceId, c.req.valid("json")),
      200,
    );
  })
  .openapi(reorderSprintGoalsRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { goalIds } = c.req.valid("json");
    return c.json(await reorderSprintGoals(workspaceId, goalIds), 200);
  })
  .openapi(updateSprintGoalRoute, async (c) => {
    const { workspaceId, goalId } = c.req.valid("param");
    return c.json(
      await updateSprintGoal(workspaceId, goalId, c.req.valid("json")),
      200,
    );
  })
  .openapi(deleteSprintGoalRoute, async (c) => {
    const { workspaceId, goalId } = c.req.valid("param");
    return c.json(await deleteSprintGoal(workspaceId, goalId), 200);
  })
  .openapi(linkSprintGoalTasksRoute, async (c) => {
    const { workspaceId, goalId } = c.req.valid("param");
    const { taskIds } = c.req.valid("json");
    return c.json(await linkSprintGoalTasks(workspaceId, goalId, taskIds), 200);
  })
  .openapi(unlinkSprintGoalTaskRoute, async (c) => {
    const { workspaceId, goalId, taskId } = c.req.valid("param");
    return c.json(await unlinkSprintGoalTask(workspaceId, goalId, taskId), 200);
  });

export default sprint;
