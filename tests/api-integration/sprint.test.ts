import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { sprintTable } from "../../apps/api/src/database/schema";
import closeSprint from "../../apps/api/src/sprint/controllers/close-sprint";
import getSprintTasks from "../../apps/api/src/sprint/controllers/get-sprint-tasks";
import getSprints from "../../apps/api/src/sprint/controllers/get-sprints";
import {
  createSprintGoal,
  getSprintGoals,
  linkSprintGoalTasks,
  reorderSprintGoals,
  unlinkSprintGoalTask,
  updateSprintGoal,
} from "../../apps/api/src/sprint/controllers/sprint-goals";
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

describe("sprint goals", () => {
  it("scores goals at close and carries the chosen ones into the next sprint", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const ship = await createSprintGoal(workspace.id, {
      title: "Ship billing",
      points: 5,
      ownerId: user.id,
    });
    const docs = await createSprintGoal(workspace.id, {
      title: "Write docs",
      points: 3,
    });
    const hire = await createSprintGoal(workspace.id, {
      title: "Hire",
      points: 2,
    });
    if (!ship || !docs || !hire) throw new Error("Goals were not created");

    const sprint = await closeSprint({
      workspaceId: workspace.id,
      currentUserId: user.id,
      goals: [
        { goalId: ship.id, result: "fully", carryOver: false },
        { goalId: docs.id, result: "half", carryOver: true },
        { goalId: hire.id, result: "none", carryOver: false },
      ],
    });
    expect(sprint).toMatchObject({
      goalPointsEarned: 6.5,
      goalPointsTotal: 10,
    });
    expect(sprint.goals.map((goal) => [goal.id, goal.result])).toEqual([
      [ship.id, "fully"],
      [docs.id, "half"],
      [hire.id, "none"],
    ]);

    const open = await getSprintGoals(workspace.id);
    expect(open).toEqual([
      expect.objectContaining({
        title: "Write docs",
        points: 3,
        result: null,
        sprintId: null,
        carriedFromGoalId: docs.id,
        carryOverCount: 1,
      }),
    ]);

    const [history] = await getSprints(workspace.id);
    expect(history?.goals).toHaveLength(3);
    expect(history?.goals[0]?.ownerName).toBe(user.name);
  });

  it("refuses to close while an open goal has no result", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const goal = await createSprintGoal(workspace.id, { title: "Launch" });
    if (!goal) throw new Error("Goal was not created");

    await expect(
      closeSprint({ workspaceId: workspace.id, currentUserId: user.id }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      closeSprint({
        workspaceId: workspace.id,
        currentUserId: user.id,
        goals: [
          { goalId: goal.id, result: "fully", carryOver: false },
          { goalId: "not-a-goal", result: "none", carryOver: false },
        ],
      }),
    ).rejects.toMatchObject({ status: 400 });

    expect(await db.select().from(sprintTable)).toHaveLength(0);
    expect((await getSprintGoals(workspace.id))[0]?.sprintId).toBeNull();
  });

  it("keeps goals inside their workspace and freezes closed ones", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const { user: outsider, workspace: other } = await createWorkspaceMember();
    const goal = await createSprintGoal(workspace.id, { title: "Launch" });
    if (!goal) throw new Error("Goal was not created");

    await expect(
      updateSprintGoal(other.id, goal.id, { title: "Hijacked" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      updateSprintGoal(workspace.id, goal.id, { ownerId: outsider.id }),
    ).rejects.toMatchObject({ status: 400 });

    await closeSprint({
      workspaceId: workspace.id,
      currentUserId: user.id,
      goals: [{ goalId: goal.id, result: "fully", carryOver: false }],
    });
    await expect(
      updateSprintGoal(workspace.id, goal.id, { points: 8 }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("reorders the open goals", async () => {
    const { workspace } = await createWorkspaceMember();
    const first = await createSprintGoal(workspace.id, { title: "First" });
    const second = await createSprintGoal(workspace.id, { title: "Second" });
    if (!first || !second) throw new Error("Goals were not created");

    const reordered = await reorderSprintGoals(workspace.id, [
      second.id,
      first.id,
    ]);
    expect(reordered.map((goal) => goal.title)).toEqual(["Second", "First"]);
    await expect(
      reorderSprintGoals(workspace.id, [second.id]),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("sprint goal tickets", () => {
  it("tracks progress and carries only unfinished tickets over", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const done = await insertTask({
      projectId: project.id,
      number: 1,
      status: "done",
    });
    const open = await insertTask({ projectId: project.id, number: 2 });
    const dropped = await insertTask({
      projectId: project.id,
      number: 3,
      status: "cancelled",
      cancelReason: "Out of scope",
    });
    if (!done || !open || !dropped) throw new Error("Tasks were not created");

    const goal = await createSprintGoal(workspace.id, {
      title: "Launch",
      points: 4,
      taskIds: [done.id, open.id],
    });
    if (!goal) throw new Error("Goal was not created");
    const linked = await linkSprintGoalTasks(workspace.id, goal.id, [
      dropped.id,
      open.id,
    ]);
    // The cancelled ticket is dropped work and leaves the progress.
    expect(linked).toMatchObject({ taskCount: 2, doneTaskCount: 1 });
    expect(linked?.tasks.map((task) => task.id)).not.toContain(dropped.id);
    // Unfinished tickets lead the list.
    expect(linked?.tasks.at(-1)?.id).toBe(done.id);

    await closeSprint({
      workspaceId: workspace.id,
      currentUserId: user.id,
      goals: [{ goalId: goal.id, result: "half", carryOver: true }],
    });

    const [history] = await getSprints(workspace.id);
    const closed = history?.goals[0];
    expect(closed).toMatchObject({ taskCount: 2, doneTaskCount: 1 });
    expect(closed?.tasks.find((task) => task.id === done.id)).toMatchObject({
      status: "archived",
      done: true,
    });

    const [next] = await getSprintGoals(workspace.id);
    expect(next?.carriedFromGoalId).toBe(goal.id);
    expect(next?.tasks.map((task) => task.id)).toEqual([open.id]);
  });

  it("re-creates repeating goals fresh every sprint", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const task = await insertTask({ projectId: project.id, number: 1 });
    if (!task) throw new Error("Task was not created");
    const weekly = await createSprintGoal(workspace.id, {
      title: "Inbox zero",
      points: 2,
      repeatWeekly: true,
      taskIds: [task.id],
    });
    const carried = await createSprintGoal(workspace.id, {
      title: "Weekly demo",
      repeatWeekly: true,
    });
    if (!weekly || !carried) throw new Error("Goals were not created");
    await updateSprintGoal(workspace.id, carried.id, { title: "Demo" });

    await closeSprint({
      workspaceId: workspace.id,
      currentUserId: user.id,
      goals: [
        { goalId: weekly.id, result: "none", carryOver: false },
        { goalId: carried.id, result: "half", carryOver: true },
      ],
    });

    const next = await getSprintGoals(workspace.id);
    expect(next).toEqual([
      expect.objectContaining({
        title: "Inbox zero",
        points: 2,
        repeatWeekly: true,
        carryOverCount: 0,
        carriedFromGoalId: null,
        taskCount: 0,
      }),
      // Carried and repeating: the carried copy is next week's only one.
      expect.objectContaining({
        title: "Demo",
        repeatWeekly: true,
        carryOverCount: 1,
        carriedFromGoalId: carried.id,
      }),
    ]);
  });

  it("only links tasks of the goal's workspace and unlinks them", async () => {
    const { workspace } = await createWorkspaceMember();
    const { workspace: other } = await createWorkspaceMember();
    const { project: foreign } = await createProjectFixture({
      workspaceId: other.id,
    });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const outsider = await insertTask({ projectId: foreign.id, number: 1 });
    const own = await insertTask({ projectId: project.id, number: 1 });
    const goal = await createSprintGoal(workspace.id, { title: "Launch" });
    if (!outsider || !own || !goal) throw new Error("Fixtures missing");

    await expect(
      linkSprintGoalTasks(workspace.id, goal.id, [outsider.id]),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      createSprintGoal(workspace.id, { title: "x", taskIds: [outsider.id] }),
    ).rejects.toMatchObject({ status: 400 });

    await linkSprintGoalTasks(workspace.id, goal.id, [own.id]);
    const unlinked = await unlinkSprintGoalTask(workspace.id, goal.id, own.id);
    expect(unlinked?.taskCount).toBe(0);
    expect(
      await db
        .select()
        .from(schema.taskTable)
        .where(eq(schema.taskTable.id, own.id)),
    ).toHaveLength(1);
  });
});

describe("projects outside the sprint", () => {
  it("are left off the board and untouched by closing the sprint", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const { project: product } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const { project: qa } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    await db
      .update(schema.projectTable)
      .set({ inSprint: false })
      .where(eq(schema.projectTable.id, qa.id));

    const shipped = await insertTask({
      projectId: product.id,
      number: 1,
      status: "done",
    });
    const qaDone = await insertTask({
      projectId: qa.id,
      number: 1,
      status: "done",
    });
    const qaOpen = await insertTask({ projectId: qa.id, number: 2 });
    if (!shipped || !qaDone || !qaOpen) throw new Error("Tasks missing");

    const board = await getSprintBoard(workspace.id);
    const onBoard = board.data.columns.flatMap((column) =>
      column.tasks.map((task) => task.id),
    );
    expect(onBoard).toEqual([shipped.id]);

    // A QA ticket can still be linked to a goal on purpose.
    const goal = await createSprintGoal(workspace.id, {
      title: "Release",
      taskIds: [qaOpen.id],
    });
    if (!goal) throw new Error("Goal was not created");
    expect(goal.taskCount).toBe(1);

    const sprint = await closeSprint({
      workspaceId: workspace.id,
      currentUserId: user.id,
      goals: [{ goalId: goal.id, result: "none", carryOver: true }],
    });
    expect(sprint).toMatchObject({ completedCount: 1, carriedOverCount: 0 });

    const rows = new Map(
      (await db.select().from(schema.taskTable)).map((row) => [row.id, row]),
    );
    expect(rows.get(shipped.id)?.status).toBe("archived");
    expect(rows.get(qaDone.id)).toMatchObject({
      status: "done",
      sprintId: null,
      carryOverCount: 0,
    });
    expect(rows.get(qaOpen.id)?.carryOverCount).toBe(0);
    // The carried goal still follows its QA ticket.
    const [next] = await getSprintGoals(workspace.id);
    expect(next?.tasks.map((task) => task.id)).toEqual([qaOpen.id]);
  });
});
