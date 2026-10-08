import { BLOCKED_STATUS, CANCELLED_STATUS } from "@/constants/task-workflow";
import { toast } from "@/lib/toast";
import useTaskReasonPromptStore, {
  type ReasonPromptKind,
  type ReasonPromptTarget,
} from "@/store/task-reason-prompt";
import type Task from "@/types/task";

// Named AbortError so the query client treats a dismissed prompt as expected
// control flow rather than a failure worth reporting.
export class ReasonPromptCancelledError extends Error {
  constructor() {
    super("The action was cancelled");
    this.name = "AbortError";
  }
}

export function isReasonPromptCancelled(error: unknown) {
  return error instanceof ReasonPromptCancelledError;
}

async function requestReason(
  kind: ReasonPromptKind,
  target: ReasonPromptTarget,
) {
  const result = await useTaskReasonPromptStore
    .getState()
    .request(kind, target);
  if (!result) throw new ReasonPromptCancelledError();
  return result;
}

type StatusDetails = Partial<
  Pick<Task, "blockedReason" | "blockedOnUserId" | "cancelReason">
>;

/** Asks for the reason a status needs, if it has none yet. */
async function requestStatusDetails(
  status: string,
  title: string,
): Promise<StatusDetails> {
  if (status === BLOCKED_STATUS) {
    const { reason, blockedOnUserId } = await requestReason("blocked", {
      title,
    });
    return { blockedReason: reason, blockedOnUserId };
  }
  if (status === CANCELLED_STATUS) {
    const { reason } = await requestReason("cancel", { title });
    return { cancelReason: reason };
  }
  return {};
}

/**
 * Fills in the reason before a task enters Blocked or Cancelled. Tasks
 * already carrying their reason keep it.
 */
export async function withStatusDetails<T extends Task>(task: T): Promise<T> {
  const hasReason =
    (task.status === BLOCKED_STATUS && task.blockedReason) ||
    (task.status === CANCELLED_STATUS && task.cancelReason);
  if (hasReason) return task;

  return { ...task, ...(await requestStatusDetails(task.status, task.title)) };
}

/** Same prompt for a task that does not exist yet. */
export function requestStatusDetailsForNewTask(status: string, title: string) {
  return requestStatusDetails(status, title);
}

/** Lets someone change the details of an already blocked task. */
export async function editBlockedDetails(task: Task) {
  const { reason, blockedOnUserId } = await requestReason("blocked", {
    title: task.title,
    reason: task.blockedReason,
    blockedOnUserId: task.blockedOnUserId,
  });
  return { ...task, blockedReason: reason, blockedOnUserId };
}

export async function requestDeleteReason(target: ReasonPromptTarget) {
  return (await requestReason("delete", target)).reason;
}

/** Request fields for the status details, sent only for the matching status. */
export function statusDetailsPayload(task: StatusDetails & { status: string }) {
  if (task.status === BLOCKED_STATUS) {
    return {
      blockedReason: task.blockedReason ?? undefined,
      // undefined keeps the stored person; null clears it.
      blockedOnUserId: task.blockedOnUserId,
    };
  }
  if (task.status === CANCELLED_STATUS) {
    return { cancelReason: task.cancelReason ?? undefined };
  }
  return {};
}

/** Shows a failed task update, staying quiet when the user dismissed the prompt. */
export function toastTaskUpdateError(error: unknown, fallback: string) {
  if (isReasonPromptCancelled(error)) return;
  toast.error(
    error instanceof Error && error.message ? error.message : fallback,
  );
}
