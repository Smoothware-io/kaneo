import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function unlinkSprintGoalTask(
  workspaceId: string,
  goalId: string,
  taskId: string,
) {
  const response = await client.sprint.goals[":workspaceId"][":goalId"].tasks[
    ":taskId"
  ].$delete({ param: { workspaceId, goalId, taskId } });
  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }
  return response.json();
}

export default unlinkSprintGoalTask;
