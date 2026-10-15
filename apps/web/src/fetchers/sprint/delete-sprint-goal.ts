import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function deleteSprintGoal(workspaceId: string, goalId: string) {
  const response = await client.sprint.goals[":workspaceId"][":goalId"].$delete(
    { param: { workspaceId, goalId } },
  );
  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }
  return response.json();
}

export default deleteSprintGoal;
