import { Archive, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { useArchiveCompleted } from "@/hooks/mutations/task/use-archive-completed";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import { ArchiveTasksModal } from "../../shared/modals/archive-tasks-modal";

type ColumnHeaderProps = {
  column: ProjectWithTasks["columns"][number];
  variant?: "project" | "personal";
};

export function ColumnHeader({
  column,
  variant = "project",
}: ColumnHeaderProps) {
  const { t } = useTranslation();
  const { project } = useProjectStore();
  const { mutateAsync: archiveCompleted } = useArchiveCompleted();
  const { canUpdateTasks, canCreateTasks } = useWorkspacePermission();
  const canTask = canUpdateTasks();
  const canCreate = canCreateTasks();

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const handleConfirmArchive = async () => {
    if (!column.isFinal || !project) return;
    setIsArchiveModalOpen(false);

    try {
      const { archivedCount } = await archiveCompleted(project.id);
      toast.success(
        t("tasks:archiveCompleted.success", { count: archivedCount }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:archiveCompleted.error"),
      );
    }
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">
          {getColumnIcon(column.id, column.isFinal, column.icon)}
        </span>
        <span className="truncate text-sm font-medium text-foreground/95">
          {column.name}
        </span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {column.tasks.length}
        </span>
      </div>

      <div className="flex items-center">
        {variant !== "personal" &&
          canTask &&
          column.isFinal &&
          column.tasks.length > 0 && (
            <button
              type="button"
              onClick={() => setIsArchiveModalOpen(true)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              title={t("tasks:archiveCompleted.tooltip")}
            >
              <Archive className="w-4 h-4" />
              <span>{t("tasks:archiveCompleted.action")}</span>
            </button>
          )}
        {variant !== "personal" && canCreate && (
          <button
            type="button"
            onClick={() => setIsTaskModalOpen(true)}
            className="flex items-center rounded-md px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-accent/50"
            title={t("tasks:kanban.addTask")}
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <CreateTaskModal
        open={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        projectId={project?.id}
        status={column.id}
      />

      <ArchiveTasksModal
        open={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        onConfirm={handleConfirmArchive}
        taskCount={column.tasks.length}
      />
    </div>
  );
}
