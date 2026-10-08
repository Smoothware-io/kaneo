import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useDeleteTask } from "@/hooks/mutations/task/use-delete-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { toastTaskUpdateError } from "@/lib/task-reason";
import { toast } from "@/lib/toast";

type TaskDeleteButtonProps = {
  taskId: string;
  taskTitle: string;
  onDeleted: () => void;
  className?: string;
};

export default function TaskDeleteButton({
  taskId,
  taskTitle,
  onDeleted,
  className,
}: TaskDeleteButtonProps) {
  const { t } = useTranslation();
  const { canDeleteTasks, isCheckingPermissions } = useWorkspacePermission();
  const { mutateAsync: deleteTask, isPending } = useDeleteTask();

  if (isCheckingPermissions || !canDeleteTasks()) {
    return null;
  }

  // The reason dialog doubles as the confirmation step.
  const handleDelete = async () => {
    try {
      await deleteTask({ id: taskId, title: taskTitle });
      toast.success(t("tasks:delete.success"));
      onDeleted();
    } catch (error) {
      toastTaskUpdateError(error, t("tasks:delete.error"));
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={t("tasks:delete.action")}
      disabled={isPending}
      onClick={() => void handleDelete()}
      className={cn(
        "text-destructive hover:bg-destructive/10 hover:text-destructive",
        className,
      )}
    >
      <Trash2 className="size-4" />
      <span className="hidden sm:inline">{t("tasks:delete.action")}</span>
    </Button>
  );
}
