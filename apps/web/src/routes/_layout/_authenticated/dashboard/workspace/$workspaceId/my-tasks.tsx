import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { TaskLabels } from "@/components/kanban-board/task-labels";
import PageTitle from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useGetMyTasks } from "@/hooks/queries/task/use-get-my-tasks";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/my-tasks",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { data, isLoading } = useGetMyTasks(workspaceId);
  const { data: projects } = useGetProjects({ workspaceId });

  const projectsById = useMemo(() => {
    const map = new Map<string, { name: string; slug: string }>();
    for (const project of projects ?? []) {
      map.set(project.id, { name: project.name, slug: project.slug });
    }
    return map;
  }, [projects]);

  const columns = data?.data.columns ?? [];
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
          <div className="min-h-0 flex-1 overflow-x-auto">
            <div className="flex h-full min-w-max gap-4 p-4">
              {columns.map((column) => (
                <div
                  key={column.id}
                  className="flex h-full w-80 shrink-0 flex-col rounded-xl border border-border/70 bg-card"
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium text-foreground">
                      {column.name}
                    </span>
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-sm border border-border/60 px-1 text-[11px] font-medium text-muted-foreground">
                      {column.tasks.length}
                    </span>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-2 pb-4">
                    {column.tasks.map((task) => {
                      const project = projectsById.get(task.projectId);
                      return (
                        <Link
                          key={task.id}
                          to="/dashboard/workspace/$workspaceId/project/$projectId/board"
                          params={{ workspaceId, projectId: task.projectId }}
                          search={{ taskId: task.id }}
                          className="group rounded-lg border border-border bg-background p-3 transition-[background-color,border-color,box-shadow] duration-150 hover:border-border/90 hover:shadow-sm"
                        >
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
                            {task.priority &&
                              task.priority !== "no-priority" && (
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
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </WorkspaceLayout>
    </>
  );
}
