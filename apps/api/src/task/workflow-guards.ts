import { and, count, eq, notInArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type db from "../database";
import { projectTable, taskTable, userTable } from "../database/schema";
import { publishEvent } from "../events";
import { assertAssignableUser } from "../utils/assert-assignable-user";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export const IN_PROGRESS_STATUS = "in-progress";
export const BLOCKED_STATUS = "blocked";
export const CANCELLED_STATUS = "cancelled";
export const ARCHIVED_STATUS = "archived";
// Statuses that need a per-task reason, so they cannot be applied in bulk.
export const REASON_STATUSES = [BLOCKED_STATUS, CANCELLED_STATUS] as const;
export const MAX_IN_PROGRESS_TASKS_PER_USER = 2;
export const MAX_BLOCKED_REASON_LENGTH = 2000;

type TaskWorkState = {
  status: string;
  userId: string | null;
};

/**
 * A task only consumes someone's in-progress capacity when it newly lands in
 * the column for that assignee. Reordering inside the column, or saving an
 * unchanged task, must never trip the limit.
 */
export function entersInProgressFor(
  previous: TaskWorkState | null,
  next: TaskWorkState,
): string | null {
  if (next.status !== IN_PROGRESS_STATUS || !next.userId) return null;
  if (
    previous?.status === IN_PROGRESS_STATUS &&
    previous.userId === next.userId
  ) {
    return null;
  }
  return next.userId;
}

/**
 * Enforces the per-person in-progress limit across the whole workspace, since
 * focus spans every project someone works in. Call inside the transaction
 * that writes the change: the advisory lock serializes concurrent moves for
 * the same person so two requests cannot both take the last slot.
 */
export async function assertInProgressCapacity(
  tx: Executor,
  workspaceId: string,
  incoming: { userId: string; taskId?: string }[],
) {
  if (incoming.length === 0) return;

  const byUser = new Map<string, string[]>();
  for (const entry of incoming) {
    const taskIds = byUser.get(entry.userId) ?? [];
    if (entry.taskId) taskIds.push(entry.taskId);
    byUser.set(entry.userId, taskIds);
  }

  for (const [userId, taskIds] of byUser) {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(1525, hashtext(${`${workspaceId}:${userId}`}))`,
    );

    const incomingCount = incoming.filter((e) => e.userId === userId).length;

    const [row] = await tx
      .select({ value: count() })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .where(
        and(
          eq(projectTable.workspaceId, workspaceId),
          eq(taskTable.userId, userId),
          eq(taskTable.status, IN_PROGRESS_STATUS),
          taskIds.length > 0 ? notInArray(taskTable.id, taskIds) : undefined,
        ),
      );

    const current = row?.value ?? 0;
    if (current + incomingCount <= MAX_IN_PROGRESS_TASKS_PER_USER) continue;

    const [user] = await tx
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    throw new HTTPException(409, {
      message: `${user?.name ?? "This person"} already has ${current} of ${MAX_IN_PROGRESS_TASKS_PER_USER} tasks in progress. Finish or move one before starting another.`,
    });
  }
}

export type StatusDetailsInput = {
  blockedReason?: string | null;
  blockedOnUserId?: string | null;
  cancelReason?: string | null;
};

type BlockedState = {
  blockedReason: string | null;
  blockedOnUserId: string | null;
};

type StatusDetails = BlockedState & {
  cancelReason: string | null;
  archivedAt: Date | null;
};

type PreviousStatusDetails = Partial<StatusDetails> & { status: string };

/** Trims a reason and enforces the shared length limit. */
export function normalizeReason(
  value: string | null | undefined,
  label: string,
) {
  const reason = value?.trim() || null;
  if (reason && reason.length > MAX_BLOCKED_REASON_LENGTH) {
    throw new HTTPException(400, {
      message: `The ${label} must be at most ${MAX_BLOCKED_REASON_LENGTH} characters.`,
    });
  }
  return reason;
}

// Entering the status needs a fresh value; staying keeps the stored one unless
// a new one is sent.
function carriedReason(
  input: string | null | undefined,
  stays: boolean,
  stored: string | null | undefined,
  label: string,
) {
  return input !== undefined
    ? normalizeReason(input, label)
    : stays
      ? (stored ?? null)
      : null;
}

/**
 * Resolves the status-dependent fields to persist for a status write:
 * Blocked needs a reason (and optionally who is needed), Cancelled needs a
 * reason, and Archived records when it happened. Leaving a status clears its
 * fields so stale details never resurface.
 */
export async function resolveStatusDetails({
  workspaceId,
  previous,
  nextStatus,
  input,
}: {
  workspaceId: string;
  previous: PreviousStatusDetails | null;
  nextStatus: string;
  input: StatusDetailsInput;
}): Promise<StatusDetails> {
  const details: StatusDetails = {
    blockedReason: null,
    blockedOnUserId: null,
    cancelReason: null,
    archivedAt: null,
  };

  if (nextStatus === ARCHIVED_STATUS) {
    details.archivedAt =
      previous?.status === ARCHIVED_STATUS && previous.archivedAt
        ? previous.archivedAt
        : new Date();
  }

  if (nextStatus === CANCELLED_STATUS) {
    details.cancelReason = carriedReason(
      input.cancelReason,
      previous?.status === CANCELLED_STATUS,
      previous?.cancelReason,
      "cancel reason",
    );
    if (!details.cancelReason) {
      throw new HTTPException(400, {
        message: "A reason is required to cancel a task.",
      });
    }
  }

  if (nextStatus === BLOCKED_STATUS) {
    const wasBlocked = previous?.status === BLOCKED_STATUS;
    details.blockedReason = carriedReason(
      input.blockedReason,
      wasBlocked,
      previous?.blockedReason,
      "blocked reason",
    );
    if (!details.blockedReason) {
      throw new HTTPException(400, {
        message: "A reason is required to move a task to Blocked.",
      });
    }

    details.blockedOnUserId =
      input.blockedOnUserId !== undefined
        ? input.blockedOnUserId?.trim() || null
        : wasBlocked
          ? (previous?.blockedOnUserId ?? null)
          : null;

    if (
      details.blockedOnUserId &&
      details.blockedOnUserId !== previous?.blockedOnUserId
    ) {
      await assertAssignableUser(details.blockedOnUserId, workspaceId);
    }
  }

  return details;
}

/** Fields to clear when a status is set without per-task details (bulk, close week). */
export function statusDetailsWithoutInput(status: string): StatusDetails {
  return {
    blockedReason: null,
    blockedOnUserId: null,
    cancelReason: null,
    archivedAt: status === ARCHIVED_STATUS ? new Date() : null,
  };
}

/** Returns the person newly asked to unblock a task, if any. */
export function newlyBlockedOnUser(
  previous: (Partial<BlockedState> & { status: string }) | null,
  next: BlockedState & { status: string },
): string | null {
  if (next.status !== BLOCKED_STATUS || !next.blockedOnUserId) return null;
  if (
    previous?.status === BLOCKED_STATUS &&
    previous.blockedOnUserId === next.blockedOnUserId
  ) {
    return null;
  }
  return next.blockedOnUserId;
}

export async function publishBlockedOnUser(
  previous: Parameters<typeof newlyBlockedOnUser>[0],
  next: {
    id: string;
    projectId: string;
    title: string;
    status: string;
    blockedReason: string | null;
    blockedOnUserId: string | null;
  },
  currentUserId: string | undefined,
) {
  const blockedOnUserId = newlyBlockedOnUser(previous, next);
  if (!blockedOnUserId) return;

  await publishEvent("task.blocked_on_user", {
    taskId: next.id,
    projectId: next.projectId,
    userId: currentUserId,
    blockedOnUserId,
    blockedReason: next.blockedReason,
    title: next.title,
  });
}
