import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type SprintGoalOutcome = NonNullable<
  InferRequestType<
    (typeof client)["sprint"]["close"][":workspaceId"]["$post"]
  >["json"]["goals"]
>[number];

async function closeSprint(workspaceId: string, goals: SprintGoalOutcome[]) {
  const response = await client.sprint.close[":workspaceId"].$post({
    param: { workspaceId },
    json: { goals },
  });
  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }
  return response.json();
}

export default closeSprint;
