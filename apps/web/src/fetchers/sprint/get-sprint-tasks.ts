import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getSprintTasks(
  workspaceId: string,
  sprintId: string,
  signal?: AbortSignal,
) {
  const response = await client.sprint.history[":workspaceId"][
    ":sprintId"
  ].$get({ param: { workspaceId, sprintId } }, { init: { signal } });
  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }
  return response.json();
}

export default getSprintTasks;
