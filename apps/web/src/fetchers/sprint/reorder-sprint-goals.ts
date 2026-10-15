import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function reorderSprintGoals(workspaceId: string, goalIds: string[]) {
  const response = await client.sprint.goals[":workspaceId"].order.$put({
    param: { workspaceId },
    json: { goalIds },
  });
  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }
  return response.json();
}

export default reorderSprintGoals;
