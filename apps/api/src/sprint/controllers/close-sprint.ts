import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import db from "../../database";
import { projectTable, sprintTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { getSubtaskParentProjects } from "../../task/get-subtask-parent-projects";
import { taskIsCompleted } from "../../task/task-is-completed";
import {
  ARCHIVED_STATUS,
  statusDetailsWithoutInput,
} from "../../task/workflow-guards";
import { isoWeek } from "../iso-week";

// Statuses that are not part of a running sprint, so they never carry over.
const OFF_SPRINT_STATUSES = ["planned", "archived", "cancelled"];

/**
 * Closes the workspace's weekly sprint: every finished task in an active
 * project is archived under this sprint, and every unfinished one stays on
 * the board with its carry-over count raised, so slipping work is visible.
 */
async function closeSprint({
  workspaceId,
  currentUserId,
}: {
  workspaceId: string;
  currentUserId: string;
}) {
  const { sprint, archived, carriedProjectIds } = await db.transaction(
    async (tx) => {
      // Two admins pressing close at once must not create two sprints.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(1526, hashtext(${workspaceId}))`,
      );

      const activeProjectIds = tx
        .select({ id: projectTable.id })
        .from(projectTable)
        .where(
          and(
            eq(projectTable.workspaceId, workspaceId),
            isNull(projectTable.archivedAt),
          ),
        );

      const closedAt = new Date();
      const { weekYear, week } = isoWeek(closedAt);
      const [created] = await tx
        .insert(sprintTable)
        .values({
          workspaceId,
          weekYear,
          week,
          closedAt,
          closedById: currentUserId,
        })
        .returning();
      if (!created) throw new Error("Failed to record the sprint");

      // Snapshot of the finished rows, so events carry each old status.
      const finishing = tx
        .select({ id: taskTable.id, oldStatus: taskTable.status })
        .from(taskTable)
        .where(
          and(inArray(taskTable.projectId, activeProjectIds), taskIsCompleted),
        )
        .as("finishing");

      const archivedRows = await tx
        .update(taskTable)
        .set({
          status: ARCHIVED_STATUS,
          columnId: null,
          sprintId: created.id,
          ...statusDetailsWithoutInput(ARCHIVED_STATUS),
        })
        .from(finishing)
        .where(eq(taskTable.id, finishing.id))
        .returning({
          id: taskTable.id,
          title: taskTable.title,
          userId: taskTable.userId,
          projectId: taskTable.projectId,
          oldStatus: finishing.oldStatus,
        });

      // Finished tasks are archived by now, so everything still open is
      // unfinished work rolling into next week.
      const carriedRows = await tx
        .update(taskTable)
        .set({ carryOverCount: sql`${taskTable.carryOverCount} + 1` })
        .where(
          and(
            inArray(taskTable.projectId, activeProjectIds),
            notInArray(taskTable.status, OFF_SPRINT_STATUSES),
          ),
        )
        .returning({ projectId: taskTable.projectId });

      const [sprintWithCounts] = await tx
        .update(sprintTable)
        .set({
          completedCount: archivedRows.length,
          carriedOverCount: carriedRows.length,
        })
        .where(eq(sprintTable.id, created.id))
        .returning();

      return {
        sprint: sprintWithCounts ?? created,
        archived: archivedRows,
        carriedProjectIds: carriedRows.map((row) => row.projectId),
      };
    },
  );

  if (archived.length > 0) {
    const parentProjects = await getSubtaskParentProjects(
      archived.map((task) => task.id),
    );
    await publishEvent("subtask-parents.refresh", { projects: parentProjects });
  }

  for (const task of archived) {
    await publishEvent("task.status_changed", {
      taskId: task.id,
      projectId: task.projectId,
      userId: currentUserId,
      oldStatus: task.oldStatus,
      newStatus: ARCHIVED_STATUS,
      title: task.title,
      assigneeId: task.userId,
      type: "status_changed",
      skipSubtaskParentRefresh: true,
    });
  }

  // Carried tasks change only their badge; refresh every touched board once.
  const touchedProjects = new Set([
    ...archived.map((task) => task.projectId),
    ...carriedProjectIds,
  ]);
  for (const projectId of touchedProjects) {
    await publishEvent("task-relation.refresh", {
      projectId,
      userId: currentUserId,
    });
  }

  return sprint;
}

export default closeSprint;
