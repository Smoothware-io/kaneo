import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type SprintGoal = InferResponseType<
  (typeof client)["sprint"]["goals"][":workspaceId"]["$get"],
  200
>[number];

async function getSprintGoals(workspaceId: string, signal?: AbortSignal) {
  const response = await client.sprint.goals[":workspaceId"].$get(
    { param: { workspaceId } },
    { init: { signal } },
  );
  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }
  return response.json();
}

export default getSprintGoals;
