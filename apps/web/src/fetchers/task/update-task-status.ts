import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import { statusDetailsPayload } from "@/lib/task-reason";
import type Task from "@/types/task";

type UpdateTaskStatusPayload = Pick<
  Task,
  "status" | "blockedReason" | "blockedOnUserId" | "cancelReason"
>;

async function updateTaskStatus(taskId: string, task: UpdateTaskStatusPayload) {
  const response = await client.task.status[":id"].$put({
    param: { id: taskId },
    json: {
      status: task.status || "",
      ...statusDetailsPayload(task),
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default updateTaskStatus;
