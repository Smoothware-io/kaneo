import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getMyTasks(workspaceId: string, signal?: AbortSignal) {
  const response = await client.task.my[":workspaceId"].$get(
    { param: { workspaceId } },
    { init: { signal } },
  );
  if (!response.ok)
    throw new HttpError(response.status, "Failed to fetch my tasks");
  return response.json();
}

export default getMyTasks;
