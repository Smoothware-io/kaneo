import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function archiveCompleted(projectId: string) {
  const response = await client.task["archive-completed"][":projectId"].$post({
    param: { projectId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default archiveCompleted;
