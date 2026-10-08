import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getSprints(workspaceId: string, signal?: AbortSignal) {
  const response = await client.sprint.history[":workspaceId"].$get(
    { param: { workspaceId } },
    { init: { signal } },
  );
  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }
  return response.json();
}

export default getSprints;
