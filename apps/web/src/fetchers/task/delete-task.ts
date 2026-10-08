import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type DeleteTaskRequest = InferRequestType<
  (typeof client)["task"][":id"]["$delete"]
>["param"];

async function deleteTask(taskId: string, reason: string) {
  const response = await client.task[":id"].$delete({
    param: { id: taskId },
    json: { reason },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default deleteTask;
