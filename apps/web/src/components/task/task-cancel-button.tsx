import { Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CANCELLED_STATUS } from "@/constants/task-workflow";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toastTaskUpdateError } from "@/lib/task-reason";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskCancelButtonProps = {
  task: Task;
};

// Cancelling moves the task off the board into the backlog's Cancelled
// section; the status mutation asks for the reason.
export default function TaskCancelButton({ task }: TaskCancelButtonProps) {
  const { t } = useTranslation();
  const { canUpdateTasks, isCheckingPermissions } = useWorkspacePermission();
  const { mutateAsync: updateTaskStatus, isPending } = useUpdateTaskStatus();

  if (
    isCheckingPermissions ||
    !canUpdateTasks() ||
    task.status === CANCELLED_STATUS
  ) {
    return null;
  }

  const handleCancel = async () => {
    try {
      await updateTaskStatus({ ...task, status: CANCELLED_STATUS });
      toast.success(t("tasks:cancel.success"));
    } catch (error) {
      toastTaskUpdateError(error, t("tasks:cancel.error"));
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={t("tasks:cancel.action")}
      disabled={isPending}
      onClick={() => void handleCancel()}
    >
      <Ban className="size-4" />
      <span className="hidden sm:inline">{t("tasks:cancel.action")}</span>
    </Button>
  );
}
