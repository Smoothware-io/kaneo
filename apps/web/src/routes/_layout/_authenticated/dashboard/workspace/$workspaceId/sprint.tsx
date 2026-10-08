import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format, getISOWeek, getISOWeekYear } from "date-fns";
import { produce } from "immer";
import { CalendarCheck, History } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import KanbanBoard from "@/components/kanban-board";
import PageTitle from "@/components/page-title";
import SprintHistorySheet from "@/components/sprint/sprint-history-sheet";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCloseSprint } from "@/hooks/mutations/sprint/use-close-sprint";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useGetSprintBoard } from "@/hooks/queries/sprint/use-get-sprint-board";
import { useGetSprints } from "@/hooks/queries/sprint/use-get-sprints";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";

const ALL = "all";
const UNASSIGNED = "unassigned";

type SprintSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/sprint",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): SprintSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

// A person "is on" a task when responsible for it or a team member of it.
function filterBoard(
  board: ProjectWithTasks,
  personId: string,
  projectId: string,
): ProjectWithTasks {
  if (personId === ALL && projectId === ALL) return board;
  return produce(board, (draft) => {
    for (const column of draft.columns) {
      column.tasks = column.tasks.filter((task) => {
        if (projectId !== ALL && task.projectId !== projectId) return false;
        if (personId === UNASSIGNED) return !task.userId;
        if (personId !== ALL) {
          return (
            task.userId === personId ||
            (task.memberIds ?? []).includes(personId)
          );
        }
        return true;
      });
    }
  });
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data, isLoading } = useGetSprintBoard(workspaceId);
  const { data: sprints = [] } = useGetSprints(workspaceId);
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: projects = [] } = useGetProjects({ workspaceId });
  const { mutateAsync: closeSprint, isPending: isClosing } = useCloseSprint();
  const { canManageWorkspace } = useWorkspacePermission();
  const { project, setProject } = useProjectStore();
  const [personId, setPersonId] = useState(ALL);
  const [projectId, setProjectId] = useState(ALL);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    if (data) setProject(data.data);
  }, [data, setProject]);

  const handleCloseTaskSheet = useCallback(() => {
    navigate({ to: ".", search: {}, replace: true });
  }, [navigate]);

  const isReady = !!project && project.id === "sprint";
  const visibleBoard = useMemo(
    () => (isReady ? filterBoard(project, personId, projectId) : null),
    [isReady, project, personId, projectId],
  );

  // A clicked task can belong to any project; the task sheet needs its own.
  const selectedProjectId = taskId
    ? project?.columns
        ?.flatMap((column) => column.tasks)
        .find((task) => task.id === taskId)?.projectId
    : undefined;

  const allTasks = isReady
    ? project.columns.flatMap((column) => column.tasks)
    : [];
  const finishedCount = isReady
    ? project.columns
        .filter((column) => column.isFinal)
        .reduce((sum, column) => sum + column.tasks.length, 0)
    : 0;
  const openCount = allTasks.length - finishedCount;

  const now = new Date();
  const lastSprint = sprints[0];

  const personItems = useMemo(() => {
    const items: Record<string, string> = {
      [ALL]: t("sprint:filters.allPeople"),
      [UNASSIGNED]: t("sprint:filters.unassigned"),
    };
    for (const member of workspaceUsers?.members ?? []) {
      items[member.userId] = member.user?.name ?? member.userId;
    }
    return items;
  }, [t, workspaceUsers]);

  const projectItems = useMemo(() => {
    const items: Record<string, string> = {
      [ALL]: t("sprint:filters.allProjects"),
    };
    for (const item of projects) {
      if (!item.archivedAt) items[item.id] = item.name;
    }
    return items;
  }, [t, projects]);

  const handleCloseSprint = async () => {
    setIsCloseDialogOpen(false);
    try {
      const sprint = await closeSprint(workspaceId);
      toast.success(
        t("sprint:close.success", {
          week: sprint.week,
          completed: sprint.completedCount,
          carried: sprint.carriedOverCount,
        }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("sprint:close.error"),
      );
    }
  };

  return (
    <>
      <PageTitle title={t("navigation:sidebar.sprint")} />
      <WorkspaceLayout title={t("navigation:sidebar.sprint")}>
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 md:px-5">
            <div className="mr-auto min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {t("sprint:weekLabel", {
                  week: getISOWeek(now),
                  year: getISOWeekYear(now),
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {lastSprint
                  ? t("sprint:since", {
                      date: format(new Date(lastSprint.closedAt), "PP"),
                    })
                  : t("sprint:firstSprint")}
                {" · "}
                {t("sprint:summary", {
                  open: openCount,
                  finished: finishedCount,
                })}
              </p>
            </div>

            <Select
              items={personItems}
              value={personId}
              onValueChange={(value) =>
                setPersonId(typeof value === "string" ? value : ALL)
              }
            >
              <SelectTrigger
                className="w-44"
                aria-label={t("sprint:filters.person")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {Object.entries(personItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>

            <Select
              items={projectItems}
              value={projectId}
              onValueChange={(value) =>
                setProjectId(typeof value === "string" ? value : ALL)
              }
            >
              <SelectTrigger
                className="w-44"
                aria-label={t("sprint:filters.project")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {Object.entries(projectItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsHistoryOpen(true)}
            >
              <History className="size-4" />
              {t("sprint:history.open")}
            </Button>

            {canManageWorkspace() && (
              <Button
                size="sm"
                disabled={!isReady || isClosing}
                onClick={() => setIsCloseDialogOpen(true)}
              >
                <CalendarCheck className="size-4" />
                {t("sprint:close.action")}
              </Button>
            )}
          </div>

          {isLoading || !visibleBoard ? (
            <div className="flex h-full w-full items-center justify-center p-8 text-sm text-muted-foreground">
              {t("sprint:loading")}
            </div>
          ) : allTasks.length === 0 ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                {t("sprint:empty.title")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("sprint:empty.description")}
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
              <KanbanBoard project={visibleBoard} variant="personal" />
            </div>
          )}
        </div>

        <AlertDialog
          open={isCloseDialogOpen}
          onOpenChange={setIsCloseDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("sprint:close.title", { week: getISOWeek(now) })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("sprint:close.description", {
                  finished: finishedCount,
                  open: openCount,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="outline" size="sm" />}>
                {t("common:actions.cancel")}
              </AlertDialogClose>
              <Button size="sm" onClick={() => void handleCloseSprint()}>
                {t("sprint:close.confirm")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <SprintHistorySheet
          workspaceId={workspaceId}
          open={isHistoryOpen}
          onOpenChange={setIsHistoryOpen}
        />

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
