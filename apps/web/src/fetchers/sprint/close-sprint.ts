import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function closeSprint(workspaceId: string) {
  const response = await client.sprint.close[":workspaceId"].$post({
    param: { workspaceId },
  });
  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }
  return response.json();
}

export default closeSprint;
