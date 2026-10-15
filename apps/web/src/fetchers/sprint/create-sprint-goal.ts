import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type SprintGoalInput = InferRequestType<
  (typeof client)["sprint"]["goals"][":workspaceId"]["$post"]
>["json"];

async function createSprintGoal(workspaceId: string, goal: SprintGoalInput) {
  const response = await client.sprint.goals[":workspaceId"].$post({
    param: { workspaceId },
    json: goal,
  });
  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }
  return response.json();
}

export default createSprintGoal;
