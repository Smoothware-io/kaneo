import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskMemberTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import {
  filterAssignableUsers,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";
import { getTaskMemberIds } from "../task-members";

export const MAX_TASK_MEMBERS = 50;

/** Replaces a task's team members; the responsible assignee is separate. */
async function updateTaskMembers({
  id,
  userIds,
  currentUserId,
}: {
  id: string;
  userIds: string[];
  currentUserId: string;
}) {
  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  const nextIds = [...new Set(userIds.map((userId) => userId.trim()))].filter(
    Boolean,
  );
  if (nextIds.length > MAX_TASK_MEMBERS) {
    throw new HTTPException(400, {
      message: `A task can have at most ${MAX_TASK_MEMBERS} team members.`,
    });
  }

  const workspaceId = await getProjectWorkspaceId(task.projectId);
  const assignable = await filterAssignableUsers(nextIds, workspaceId);
  if (nextIds.some((userId) => !assignable.has(userId))) {
    throw new HTTPException(403, {
      message: "Team members must belong to this workspace",
    });
  }

  const previousIds = (await getTaskMemberIds(db, [id])).get(id) ?? [];
  const added = nextIds.filter((userId) => !previousIds.includes(userId));
  const removed = previousIds.filter((userId) => !nextIds.includes(userId));

  await db.transaction(async (tx) => {
    if (removed.length > 0) {
      await tx
        .delete(taskMemberTable)
        .where(
          and(
            eq(taskMemberTable.taskId, id),
            inArray(taskMemberTable.userId, removed),
          ),
        );
    }
    if (added.length > 0) {
      await tx
        .insert(taskMemberTable)
        .values(added.map((userId) => ({ taskId: id, userId })))
        .onConflictDoNothing();
    }
  });

  if (added.length > 0 || removed.length > 0) {
    await publishEvent("task.members_changed", {
      taskId: id,
      projectId: task.projectId,
      userId: currentUserId,
      title: task.title,
      addedUserIds: added,
      removedUserIds: removed,
    });
    await publishEvent("task.updated", {
      taskId: id,
      projectId: task.projectId,
      title: task.title,
      status: task.status,
      userId: currentUserId,
    });
  }

  return { ...task, memberIds: nextIds };
}

export default updateTaskMembers;
