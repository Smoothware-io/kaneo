import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function updateTaskMembers(taskId: string, userIds: string[]) {
  const response = await client.task.members[":id"].$put({
    param: { id: taskId },
    json: { userIds },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default updateTaskMembers;
