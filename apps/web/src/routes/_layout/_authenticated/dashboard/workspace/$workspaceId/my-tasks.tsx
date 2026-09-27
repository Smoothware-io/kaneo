import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { produce } from "immer";
import { Calendar } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { TaskLabels } from "@/components/kanban-board/task-labels";
import PageTitle from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useGetMyTasks } from "@/hooks/queries/task/use-get-my-tasks";
import { cn } from "@/lib/cn";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/my-tasks",
)({
  component: RouteComponent,
});

type MyTasksBoard = NonNullable<ReturnType<typeof useGetMyTasks>["data"]>;
type MyColumn = MyTasksBoard["data"]["columns"][number];
type MyTask = MyColumn["tasks"][number];

type ProjectInfo = { name: string; slug: string };

function TaskCardBody({
  task,
  project,
}: {
  task: MyTask;
  project?: ProjectInfo;
}) {
  return (
    <>
      <div className="mb-2 break-words text-[15px] font-medium leading-5 text-foreground/95">
        {task.title}
      </div>

      {task.labels && task.labels.length > 0 && (
        <div className="mb-2">
          <TaskLabels labels={task.labels} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {project && (
          <Badge
            variant="outline"
            className="max-w-full px-2 py-0.5 text-[10px]"
          >
            <span className="truncate" title={project.name}>
              {project.name}
            </span>
          </Badge>
        )}
        {task.priority && task.priority !== "no-priority" && (
          <span className="inline-flex h-5 items-center rounded border border-border/70 bg-muted/55 px-2 text-[10px] font-medium text-muted-foreground capitalize">
            {task.priority}
          </span>
        )}
        {task.dueDate && (
          <span className="inline-flex h-5 items-center gap-1 rounded border border-border/70 bg-muted/55 px-2 text-[10px] font-medium text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(task.dueDate), "MMM d")}
          </span>
        )}
      </div>
    </>
  );
}

function DraggableCard({
  task,
  project,
  onOpen,
}: {
  task: MyTask;
  project?: ProjectInfo;
  onOpen: (task: MyTask) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: card is a draggable button-like target
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(task);
      }}
      className={cn(
        "group cursor-grab rounded-lg border border-border bg-background p-3 transition-[background-color,border-color,box-shadow] duration-150 hover:border-border/90 hover:shadow-sm active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <TaskCardBody task={task} project={project} />
    </div>
  );
}

function DroppableColumn({
  column,
  projectsById,
  onOpen,
}: {
  column: MyColumn;
  projectsById: Map<string, ProjectInfo>;
  onOpen: (task: MyTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.slug });

  return (
    <div className="flex h-full w-80 shrink-0 flex-col rounded-xl border border-border/70 bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium text-foreground">
          {column.name}
        </span>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-sm border border-border/60 px-1 text-[11px] font-medium text-muted-foreground">
          {column.tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto rounded-b-xl px-2 pb-4 transition-colors",
          isOver && "bg-accent/40",
        )}
      >
        {column.tasks.map((task) => (
          <DraggableCard
            key={task.id}
            task={task}
            project={projectsById.get(task.projectId)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetMyTasks(workspaceId);
  const { data: projects } = useGetProjects({ workspaceId });
  const { mutate: updateStatus } = useUpdateTaskStatus();

  const [columns, setColumns] = useState<MyColumn[]>([]);
  const [activeTask, setActiveTask] = useState<MyTask | null>(null);

  useEffect(() => {
    if (data) setColumns(data.data.columns);
  }, [data]);

  const projectsById = useMemo(() => {
    const map = new Map<string, ProjectInfo>();
    for (const project of projects ?? []) {
      map.set(project.id, { name: project.name, slug: project.slug });
    }
    return map;
  }, [projects]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const openTask = (task: MyTask) => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params: { workspaceId, projectId: task.projectId },
      search: { taskId: task.id },
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveTask(
      columns
        .flatMap((column) => column.tasks)
        .find((task) => task.id === id) ?? null,
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const destSlug = String(over.id);
    const source = columns.find((column) =>
      column.tasks.some((task) => task.id === taskId),
    );
    if (!source || source.slug === destSlug) return;

    const task = source.tasks.find((item) => item.id === taskId);
    if (!task) return;

    // Move optimistically. Only the status changes — positions are project-scoped
    // and must not be rewritten from this cross-project board.
    setColumns(
      produce(columns, (draft) => {
        const from = draft.find((column) => column.slug === source.slug);
        const to = draft.find((column) => column.slug === destSlug);
        if (!from || !to) return;
        from.tasks = from.tasks.filter((item) => item.id !== taskId);
        to.tasks.unshift({ ...task, status: destSlug });
      }),
    );

    updateStatus(
      { ...task, status: destSlug },
      {
        onSettled: () =>
          queryClient.invalidateQueries({
            queryKey: ["my-tasks", workspaceId],
          }),
      },
    );
  };

  const total = columns.reduce((sum, column) => sum + column.tasks.length, 0);

  return (
    <>
      <PageTitle title={t("navigation:sidebar.myTasks")} />
      <WorkspaceLayout title={t("navigation:sidebar.myTasks")}>
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center p-8 text-sm text-muted-foreground">
            {t("tasks:myTasks.loading")}
          </div>
        ) : total === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-8 text-center">
            <p className="text-sm font-medium text-foreground">
              {t("tasks:myTasks.empty.title")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("tasks:myTasks.empty.description")}
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="min-h-0 flex-1 overflow-x-auto">
              <div className="flex h-full min-w-max gap-4 p-4">
                {columns.map((column) => (
                  <DroppableColumn
                    key={column.id}
                    column={column}
                    projectsById={projectsById}
                    onOpen={openTask}
                  />
                ))}
              </div>
            </div>
            <DragOverlay>
              {activeTask ? (
                <div className="w-72 rotate-1 rounded-lg border border-ring/40 bg-background p-3 shadow-lg">
                  <TaskCardBody
                    task={activeTask}
                    project={projectsById.get(activeTask.projectId)}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </WorkspaceLayout>
    </>
  );
}
