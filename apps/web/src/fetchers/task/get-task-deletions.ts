import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getTaskDeletions(projectId: string, signal?: AbortSignal) {
  const response = await client.task.deletions[":projectId"].$get(
    { param: { projectId } },
    { init: { signal } },
  );
  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }
  return response.json();
}

export default getTaskDeletions;
