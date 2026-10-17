import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function linkSprintGoalTasks(
  workspaceId: string,
  goalId: string,
  taskIds: string[],
) {
  const response = await client.sprint.goals[":workspaceId"][
    ":goalId"
  ].tasks.$post({ param: { workspaceId, goalId }, json: { taskIds } });
  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }
  return response.json();
}

export default linkSprintGoalTasks;
