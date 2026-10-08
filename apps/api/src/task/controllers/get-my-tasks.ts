import {
  and,
  asc,
  eq,
  exists,
  inArray,
  isNull,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import {
  externalLinkTable,
  labelTable,
  projectTable,
  taskMemberTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { boundedTaskRead, type TaskReadDatabase } from "../bounded-read";
import { boardDescription, descriptionDeferred } from "../description-pages";
import { getSubtaskCounts } from "../get-subtask-counts";
import { getTaskMemberIds } from "../task-members";

// A personal board unifies tasks from every project, so it uses the fixed
// default status slugs rather than any single project's custom columns.
const CANONICAL_COLUMNS = [
  { slug: "to-do", name: "To Do", isFinal: false },
  { slug: "in-progress", name: "In Progress", isFinal: false },
  { slug: "blocked", name: "Blocked", isFinal: false },
  { slug: "in-review", name: "In Review", isFinal: false },
  { slug: "done", name: "Done", isFinal: true },
] as const;

// Personal boards stay small; one page covers every assigned task. The sprint
// board holds the whole workspace's open work, so it gets more room.
const MY_TASKS_LIMIT = 1000;
const SPRINT_LIMIT = 2000;

// Statuses that are off the sprint: backlog, history and dropped work.
const OFF_SPRINT_STATUSES = ["planned", "archived", "cancelled"];

export type WorkspaceBoardScope =
  | { kind: "personal"; userId: string }
  | { kind: "sprint" };

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function getWorkspaceBoard(
  db: TaskReadDatabase,
  workspaceId: string,
  scope: WorkspaceBoardScope,
) {
  const boardId = scope.kind === "sprint" ? "sprint" : "my-tasks";
  const base = {
    id: boardId,
    name: scope.kind === "sprint" ? "Sprint" : "My Tasks",
    slug: boardId,
    icon: null as string | null,
    description: null as string | null,
    descriptionDeferred: false,
    isPublic: false,
    workspaceId,
    backgroundVersion: null as string | null,
  };
  const pagination = (total: number) => ({
    total,
    page: 1,
    pageSize: total,
    totalPages: 1,
    relatedPage: 1,
    relatedPageSize: 100,
    relatedTotalPages: 1,
  });
  const emptyColumns = CANONICAL_COLUMNS.map((column, index) => ({
    id: column.slug,
    slug: column.slug,
    name: column.name,
    position: index,
    icon: null as string | null,
    isFinal: column.isFinal,
    tasks: [] as never[],
  }));

  const projects = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      scope.kind === "sprint"
        ? // Archived projects are out of the running sprint.
          and(
            eq(projectTable.workspaceId, workspaceId),
            isNull(projectTable.archivedAt),
          )
        : eq(projectTable.workspaceId, workspaceId),
    );
  const projectIds = projects.map((project) => project.id);

  if (projectIds.length === 0) {
    return {
      data: {
        ...base,
        columns: emptyColumns,
        archivedTasks: [],
        plannedTasks: [],
        cancelledTasks: [],
      },
      pagination: pagination(0),
    };
  }

  const rows = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      description: boardDescription,
      descriptionDeferred,
      status: taskTable.status,
      priority: taskTable.priority,
      blockedReason: taskTable.blockedReason,
      blockedOnUserId: taskTable.blockedOnUserId,
      cancelReason: taskTable.cancelReason,
      archivedAt: taskTable.archivedAt,
      carryOverCount: taskTable.carryOverCount,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      position: taskTable.position,
      createdAt: taskTable.createdAt,
      userId: taskTable.userId,
      assigneeName: userTable.name,
      assigneeId: userTable.id,
      assigneeImage: userTable.image,
      projectId: taskTable.projectId,
    })
    .from(taskTable)
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(
      and(
        inArray(taskTable.projectId, projectIds),
        scope.kind === "sprint"
          ? notInArray(taskTable.status, OFF_SPRINT_STATUSES)
          : // Responsible for the task, or helping on it as a team member.
            or(
              eq(taskTable.userId, scope.userId),
              exists(
                db
                  .select({ one: sql`1` })
                  .from(taskMemberTable)
                  .where(
                    and(
                      eq(taskMemberTable.taskId, taskTable.id),
                      eq(taskMemberTable.userId, scope.userId),
                    ),
                  ),
              ),
            ),
      ),
    )
    .orderBy(asc(taskTable.dueDate), asc(taskTable.position), asc(taskTable.id))
    .limit(scope.kind === "sprint" ? SPRINT_LIMIT : MY_TASKS_LIMIT);

  const taskIds = rows.map((task) => task.id);

  const subtaskCounts = taskIds.length
    ? await getSubtaskCounts(db, taskIds, workspaceId, false)
    : new Map<string, { completed: number; total: number }>();
  const memberIds = await getTaskMemberIds(db, taskIds);

  const labelsData = taskIds.length
    ? await db
        .select({
          id: labelTable.id,
          name: labelTable.name,
          color: labelTable.color,
          taskId: labelTable.taskId,
        })
        .from(labelTable)
        .where(inArray(labelTable.taskId, taskIds))
        .orderBy(asc(labelTable.id))
    : [];
  const labelsMap = new Map<
    string,
    Array<{ id: string; name: string; color: string }>
  >();
  for (const label of labelsData) {
    if (!label.taskId) continue;
    if (!labelsMap.has(label.taskId)) labelsMap.set(label.taskId, []);
    labelsMap
      .get(label.taskId)
      ?.push({ id: label.id, name: label.name, color: label.color });
  }

  const externalLinksData = taskIds.length
    ? await db
        .select()
        .from(externalLinkTable)
        .where(inArray(externalLinkTable.taskId, taskIds))
        .orderBy(asc(externalLinkTable.id))
    : [];
  const linksMap = new Map<string, Array<Record<string, unknown>>>();
  for (const link of externalLinksData) {
    if (!linksMap.has(link.taskId)) linksMap.set(link.taskId, []);
    linksMap
      .get(link.taskId)
      ?.push({ ...link, metadata: parseMetadata(link.metadata) });
  }

  const decorate = (task: (typeof rows)[number]) => ({
    ...task,
    subtaskCounts: subtaskCounts.get(task.id) ?? { completed: 0, total: 0 },
    memberIds: memberIds.get(task.id) ?? [],
    labels: labelsMap.get(task.id) || [],
    externalLinks: linksMap.get(task.id) || [],
  });

  const canonicalSlugs = new Set<string>(
    CANONICAL_COLUMNS.map((column) => column.slug),
  );
  const extraSlugs = Array.from(
    new Set(rows.map((task) => task.status)),
  ).filter(
    (status) =>
      status !== "archived" &&
      status !== "planned" &&
      status !== "cancelled" &&
      !canonicalSlugs.has(status),
  );
  const columnDefs = [
    ...CANONICAL_COLUMNS.map((column) => ({
      slug: column.slug,
      name: column.name,
      isFinal: column.isFinal,
    })),
    ...extraSlugs.map((slug) => ({ slug, name: slug, isFinal: false })),
  ];

  const columns = columnDefs.map((column, index) => ({
    id: column.slug,
    slug: column.slug,
    name: column.name,
    position: index,
    icon: null as string | null,
    isFinal: column.isFinal,
    tasks: rows.filter((task) => task.status === column.slug).map(decorate),
  }));

  return {
    data: {
      ...base,
      columns,
      archivedTasks: rows
        .filter((task) => task.status === "archived")
        .map(decorate),
      plannedTasks: rows
        .filter((task) => task.status === "planned")
        .map(decorate),
      cancelledTasks: rows
        .filter((task) => task.status === "cancelled")
        .map(decorate),
    },
    pagination: pagination(rows.length),
  };
}

export default function getMyTasks(workspaceId: string, userId: string) {
  return boundedTaskRead(
    (db) => getWorkspaceBoard(db, workspaceId, { kind: "personal", userId }),
    "My tasks request took too long; retry later",
  );
}

export function getSprintBoard(workspaceId: string) {
  return boundedTaskRead(
    (db) => getWorkspaceBoard(db, workspaceId, { kind: "sprint" }),
    "Sprint board request took too long; retry later",
  );
}
