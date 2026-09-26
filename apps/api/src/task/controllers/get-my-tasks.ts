import { and, asc, eq, inArray } from "drizzle-orm";
import {
  externalLinkTable,
  labelTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { boundedTaskRead, type TaskReadDatabase } from "../bounded-read";
import { boardDescription, descriptionDeferred } from "../description-pages";
import { getSubtaskCounts } from "../get-subtask-counts";

// A personal board unifies tasks from every project, so it uses the fixed
// default status slugs rather than any single project's custom columns.
const CANONICAL_COLUMNS = [
  { slug: "to-do", name: "To Do", isFinal: false },
  { slug: "in-progress", name: "In Progress", isFinal: false },
  { slug: "in-review", name: "In Review", isFinal: false },
  { slug: "done", name: "Done", isFinal: true },
] as const;

// Personal boards stay small; one page covers every assigned task.
const MY_TASKS_LIMIT = 1000;

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

async function getMyTasksBoard(
  db: TaskReadDatabase,
  workspaceId: string,
  userId: string,
) {
  const base = {
    id: "my-tasks",
    name: "My Tasks",
    slug: "my-tasks",
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
    .where(eq(projectTable.workspaceId, workspaceId));
  const projectIds = projects.map((project) => project.id);

  if (projectIds.length === 0) {
    return {
      data: {
        ...base,
        columns: emptyColumns,
        archivedTasks: [],
        plannedTasks: [],
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
        eq(taskTable.userId, userId),
      ),
    )
    .orderBy(asc(taskTable.dueDate), asc(taskTable.position), asc(taskTable.id))
    .limit(MY_TASKS_LIMIT);

  const taskIds = rows.map((task) => task.id);

  const subtaskCounts = taskIds.length
    ? await getSubtaskCounts(db, taskIds, workspaceId, false)
    : new Map<string, { completed: number; total: number }>();

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
    },
    pagination: pagination(rows.length),
  };
}

export default function getMyTasks(workspaceId: string, userId: string) {
  return boundedTaskRead(
    (db) => getMyTasksBoard(db, workspaceId, userId),
    "My tasks request took too long; retry later",
  );
}
