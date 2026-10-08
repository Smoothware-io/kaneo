import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import bulkUpdateTasks from "../../apps/api/src/task/controllers/bulk-update-tasks";
import closeWeek from "../../apps/api/src/task/controllers/close-week";
import createTask from "../../apps/api/src/task/controllers/create-task";
import deleteTask from "../../apps/api/src/task/controllers/delete-task";
import getTaskDeletions from "../../apps/api/src/task/controllers/get-task-deletions";
import updateTask from "../../apps/api/src/task/controllers/update-task";
import updateTaskAssignee from "../../apps/api/src/task/controllers/update-task-assignee";
import updateTaskMembers from "../../apps/api/src/task/controllers/update-task-members";
import updateTaskStatus from "../../apps/api/src/task/controllers/update-task-status";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const publish = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../apps/api/src/events", () => ({ publishEvent: publish }));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

async function addMember(workspaceId: string, name: string) {
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: `user-${name}`,
      email: `${name}@example.com`,
      emailVerified: true,
      name,
    })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role: "member",
    joinedAt: new Date(),
  });
  return user;
}

async function seed() {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const insertTask = async (
    values: Partial<typeof schema.taskTable.$inferInsert> & { number: number },
  ) => {
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: `Task ${values.number}`,
        status: "to-do",
        userId: user.id,
        ...values,
      })
      .returning();
    return task;
  };
  return { user, workspace, project, insertTask };
}

describe("in-progress limit", () => {
  it("rejects a third in-progress task for the same assignee", async () => {
    const { user, insertTask } = await seed();
    await insertTask({ number: 1, status: "in-progress" });
    await insertTask({ number: 2, status: "in-progress" });
    const third = await insertTask({ number: 3 });

    await expect(
      updateTaskStatus({
        id: third.id,
        status: "in-progress",
        currentUserId: user.id,
      }),
    ).rejects.toMatchObject({ status: 409 });

    const [stored] = await db
      .select({ status: schema.taskTable.status })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, third.id));
    expect(stored?.status).toBe("to-do");
  });

  it("counts in-progress tasks across every project in the workspace", async () => {
    const { user, workspace, insertTask } = await seed();
    const { project: other } = await createProjectFixture({
      workspaceId: workspace.id,
      slug: "other",
    });
    await insertTask({ number: 1, status: "in-progress" });
    await insertTask({
      number: 1,
      status: "in-progress",
      projectId: other.id,
    });

    await expect(
      createTask({
        projectId: other.id,
        currentUserId: user.id,
        userId: user.id,
        title: "Third",
        status: "in-progress",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("allows reordering and saving tasks already in progress", async () => {
    const { user, project, insertTask } = await seed();
    const first = await insertTask({ number: 1, status: "in-progress" });
    await insertTask({ number: 2, status: "in-progress" });

    const updated = await updateTask(
      first.id,
      "Renamed",
      "in-progress",
      undefined,
      undefined,
      project.id,
      undefined,
      "low",
      5,
      user.id,
      user.id,
    );
    expect(updated.title).toBe("Renamed");
  });

  it("applies when assigning someone an in-progress task", async () => {
    const { user, insertTask } = await seed();
    await insertTask({ number: 1, status: "in-progress" });
    await insertTask({ number: 2, status: "in-progress" });
    const unassigned = await insertTask({
      number: 3,
      status: "in-progress",
      userId: null,
    });

    await expect(
      updateTaskAssignee({
        id: unassigned.id,
        userId: user.id,
        currentUserId: user.id,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejects a bulk move that would exceed the limit", async () => {
    const { user, insertTask } = await seed();
    await insertTask({ number: 1, status: "in-progress" });
    const a = await insertTask({ number: 2 });
    const b = await insertTask({ number: 3 });

    await expect(
      bulkUpdateTasks({
        taskIds: [a.id, b.id],
        operation: "updateStatus",
        value: "in-progress",
        userId: user.id,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("blocked column", () => {
  it("requires a reason to enter Blocked", async () => {
    const { user, insertTask } = await seed();
    const task = await insertTask({ number: 1 });

    await expect(
      updateTaskStatus({
        id: task.id,
        status: "blocked",
        currentUserId: user.id,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("stores the reason and person, notifies them, and clears both on leaving", async () => {
    const { user, workspace, insertTask } = await seed();
    const helper = await addMember(workspace.id, "helper");
    const task = await insertTask({ number: 1 });

    const blocked = await updateTaskStatus({
      id: task.id,
      status: "blocked",
      currentUserId: user.id,
      details: {
        blockedReason: "  Waiting for API keys ",
        blockedOnUserId: helper.id,
      },
    });
    expect(blocked).toMatchObject({
      blockedReason: "Waiting for API keys",
      blockedOnUserId: helper.id,
    });
    expect(publish).toHaveBeenCalledWith(
      "task.blocked_on_user",
      expect.objectContaining({ taskId: task.id, blockedOnUserId: helper.id }),
    );

    const unblocked = await updateTaskStatus({
      id: task.id,
      status: "to-do",
      currentUserId: user.id,
    });
    expect(unblocked).toMatchObject({
      blockedReason: null,
      blockedOnUserId: null,
    });
  });

  it("rejects someone outside the workspace as the person needed", async () => {
    const { user, insertTask } = await seed();
    const { user: outsider } = await createWorkspaceMember();
    const task = await insertTask({ number: 1 });

    await expect(
      updateTaskStatus({
        id: task.id,
        status: "blocked",
        currentUserId: user.id,
        details: {
          blockedReason: "Needs review",
          blockedOnUserId: outsider.id,
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("refuses to block tasks in bulk", async () => {
    const { user, insertTask } = await seed();
    const task = await insertTask({ number: 1 });

    await expect(
      bulkUpdateTasks({
        taskIds: [task.id],
        operation: "updateStatus",
        value: "blocked",
        userId: user.id,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("cancel, close week, delete log and team members", () => {
  it("requires a reason to cancel and keeps it with the task", async () => {
    const { user, insertTask } = await seed();
    const task = await insertTask({ number: 1 });

    await expect(
      updateTaskStatus({
        id: task.id,
        status: "cancelled",
        currentUserId: user.id,
      }),
    ).rejects.toMatchObject({ status: 400 });

    const cancelled = await updateTaskStatus({
      id: task.id,
      status: "cancelled",
      currentUserId: user.id,
      details: { cancelReason: "Customer dropped the request" },
    });
    expect(cancelled).toMatchObject({
      status: "cancelled",
      cancelReason: "Customer dropped the request",
    });
  });

  it("archives every done task when closing the week and stamps archivedAt", async () => {
    const { user, project, insertTask } = await seed();
    const done = await insertTask({ number: 1, status: "done" });
    const open = await insertTask({ number: 2, status: "to-do" });

    const result = await closeWeek({
      projectId: project.id,
      currentUserId: user.id,
    });
    expect(result.archivedCount).toBe(1);

    const rows = await db
      .select({
        id: schema.taskTable.id,
        status: schema.taskTable.status,
        archivedAt: schema.taskTable.archivedAt,
      })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, project.id));
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(done.id)?.status).toBe("archived");
    expect(byId.get(done.id)?.archivedAt).toBeInstanceOf(Date);
    expect(byId.get(open.id)?.status).toBe("to-do");
    expect(publish).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({
        taskId: done.id,
        oldStatus: "done",
        newStatus: "archived",
      }),
    );
  });

  it("requires a reason to delete and keeps it in the deletion log", async () => {
    const { user, project, insertTask } = await seed();
    const task = await insertTask({ number: 7, title: "Old idea" });

    await expect(deleteTask(task.id, user.id, "  ")).rejects.toMatchObject({
      status: 400,
    });

    await deleteTask(task.id, user.id, "Duplicate of #3");

    const deletions = await getTaskDeletions(project.id);
    expect(deletions).toEqual([
      expect.objectContaining({
        taskId: task.id,
        taskNumber: 7,
        title: "Old idea",
        reason: "Duplicate of #3",
        deletedById: user.id,
      }),
    ]);
  });

  it("logs every task deleted in bulk with the shared reason", async () => {
    const { user, project, insertTask } = await seed();
    const a = await insertTask({ number: 1 });
    const b = await insertTask({ number: 2 });

    await expect(
      bulkUpdateTasks({
        taskIds: [a.id, b.id],
        operation: "delete",
        userId: user.id,
      }),
    ).rejects.toMatchObject({ status: 400 });

    await bulkUpdateTasks({
      taskIds: [a.id, b.id],
      operation: "delete",
      userId: user.id,
      reason: "Sprint scope cut",
    });
    expect(await getTaskDeletions(project.id)).toHaveLength(2);
  });

  it("sets team members separately from the responsible person", async () => {
    const { user, workspace, insertTask } = await seed();
    const helper = await addMember(workspace.id, "teammate");
    const task = await insertTask({ number: 1 });

    const updated = await updateTaskMembers({
      id: task.id,
      userIds: [helper.id, helper.id],
      currentUserId: user.id,
    });
    expect(updated.memberIds).toEqual([helper.id]);
    expect(updated.userId).toBe(user.id);
    expect(publish).toHaveBeenCalledWith(
      "task.members_changed",
      expect.objectContaining({ addedUserIds: [helper.id] }),
    );

    const { user: outsider } = await createWorkspaceMember();
    await expect(
      updateTaskMembers({
        id: task.id,
        userIds: [outsider.id],
        currentUserId: user.id,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("does not count team members toward the in-progress limit", async () => {
    const { user, workspace, insertTask } = await seed();
    const helper = await addMember(workspace.id, "busy");
    await insertTask({ number: 1, status: "in-progress", userId: helper.id });
    await insertTask({ number: 2, status: "in-progress", userId: helper.id });
    const task = await insertTask({ number: 3 });
    await updateTaskMembers({
      id: task.id,
      userIds: [helper.id],
      currentUserId: user.id,
    });

    await expect(
      updateTaskStatus({
        id: task.id,
        status: "in-progress",
        currentUserId: user.id,
      }),
    ).resolves.toMatchObject({ status: "in-progress" });
  });
});
