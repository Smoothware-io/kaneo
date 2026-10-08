import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import closeSprint from "../../apps/api/src/sprint/controllers/close-sprint";
import getSprintTasks from "../../apps/api/src/sprint/controllers/get-sprint-tasks";
import getSprints from "../../apps/api/src/sprint/controllers/get-sprints";
import { getSprintBoard } from "../../apps/api/src/task/controllers/get-my-tasks";
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

async function insertTask(
  values: Partial<typeof schema.taskTable.$inferInsert> & {
    projectId: string;
    number: number;
  },
) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({ title: `Task ${values.number}`, status: "to-do", ...values })
    .returning();
  return task;
}

describe("sprint close", () => {
  it("archives finished work in every active project and carries the rest over", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const { project: alpha } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const { project: beta } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const { project: shelved } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    await db
      .update(schema.projectTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.projectTable.id, shelved.id));

    const doneA = await insertTask({
      projectId: alpha.id,
      number: 1,
      status: "done",
    });
    const doneB = await insertTask({
      projectId: beta.id,
      number: 1,
      status: "done",
    });
    const open = await insertTask({
      projectId: alpha.id,
      number: 2,
      status: "in-progress",
    });
    const planned = await insertTask({
      projectId: beta.id,
      number: 2,
      status: "planned",
    });
    const shelvedDone = await insertTask({
      projectId: shelved.id,
      number: 1,
      status: "done",
    });

    const sprint = await closeSprint({
      workspaceId: workspace.id,
      currentUserId: user.id,
    });
    expect(sprint).toMatchObject({ completedCount: 2, carriedOverCount: 1 });

    const rows = new Map(
      (await db.select().from(schema.taskTable)).map((row) => [row.id, row]),
    );
    expect(rows.get(doneA.id)).toMatchObject({
      status: "archived",
      sprintId: sprint.id,
    });
    expect(rows.get(doneB.id)?.status).toBe("archived");
    expect(rows.get(open.id)).toMatchObject({
      status: "in-progress",
      carryOverCount: 1,
    });
    expect(rows.get(planned.id)?.carryOverCount).toBe(0);
    expect(rows.get(shelvedDone.id)?.status).toBe("done");

    const history = await getSprints(workspace.id);
    expect(history).toEqual([
      expect.objectContaining({ id: sprint.id, closedById: user.id }),
    ]);
    const finished = await getSprintTasks(workspace.id, sprint.id);
    expect(finished.map((task) => task.id).sort()).toEqual(
      [doneA.id, doneB.id].sort(),
    );
  });

  it("does not show another workspace's sprint", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const { workspace: other } = await createWorkspaceMember();
    const sprint = await closeSprint({
      workspaceId: workspace.id,
      currentUserId: user.id,
    });

    await expect(getSprintTasks(other.id, sprint.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("puts open work from every active project on the sprint board", async () => {
    const { workspace } = await createWorkspaceMember();
    const { project: alpha } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const { project: beta } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const a = await insertTask({ projectId: alpha.id, number: 1 });
    const b = await insertTask({
      projectId: beta.id,
      number: 1,
      status: "blocked",
      blockedReason: "Waiting",
    });
    await insertTask({
      projectId: beta.id,
      number: 2,
      status: "cancelled",
      cancelReason: "Dropped",
    });

    const board = await getSprintBoard(workspace.id);
    const ids = board.data.columns.flatMap((column) =>
      column.tasks.map((task) => task.id),
    );
    expect(ids.sort()).toEqual([a.id, b.id].sort());
  });
});
