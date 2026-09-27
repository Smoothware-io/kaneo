import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import KanbanBoard from "@/components/kanban-board";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { useGetMyTasks } from "@/hooks/queries/task/use-get-my-tasks";
import useProjectStore from "@/store/project";

type MyTasksSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/my-tasks",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): MyTasksSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data, isLoading } = useGetMyTasks(workspaceId);
  const { project, setProject } = useProjectStore();

  useEffect(() => {
    if (data) setProject(data.data);
  }, [data, setProject]);

  const handleCloseTaskSheet = useCallback(() => {
    navigate({ to: ".", search: {}, replace: true });
  }, [navigate]);

  const isReady = !!project && project.id === "my-tasks";

  // A clicked task can belong to any project — resolve its real project id so
  // the shared task sheet loads the correct project context.
  const selectedProjectId = taskId
    ? project?.columns
        ?.flatMap((column) => column.tasks)
        .find((task) => task.id === taskId)?.projectId
    : undefined;

  const total =
    project?.columns?.reduce((sum, column) => sum + column.tasks.length, 0) ??
    0;

  return (
    <>
      <PageTitle title={t("navigation:sidebar.myTasks")} />
      <WorkspaceLayout title={t("navigation:sidebar.myTasks")}>
        <div className="flex h-full flex-col overflow-hidden">
          {isLoading || !isReady ? (
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
            <div className="flex h-full flex-1 overflow-hidden bg-background">
              <KanbanBoard project={project} variant="personal" />
            </div>
          )}
        </div>

        <TaskDetailsSheet
          taskId={taskId}
          projectId={selectedProjectId ?? ""}
          workspaceId={workspaceId}
          onClose={handleCloseTaskSheet}
        />
      </WorkspaceLayout>
    </>
  );
}
