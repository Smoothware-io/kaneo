import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type SprintGoalPatch = InferRequestType<
  (typeof client)["sprint"]["goals"][":workspaceId"][":goalId"]["$put"]
>["json"];

async function updateSprintGoal(
  workspaceId: string,
  goalId: string,
  patch: SprintGoalPatch,
) {
  const response = await client.sprint.goals[":workspaceId"][":goalId"].$put({
    param: { workspaceId, goalId },
    json: patch,
  });
  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }
  return response.json();
}

export default updateSprintGoal;
