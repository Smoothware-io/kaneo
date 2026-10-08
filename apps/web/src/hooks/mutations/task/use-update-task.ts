import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import updateTask from "@/fetchers/task/update-task";
import { toastTaskUpdateError, withStatusDetails } from "@/lib/task-reason";
import type Task from "@/types/task";

// Fire-and-forget callers (board drag and drop) have no catch of their own,
// so they opt in to having failures shown here.
export function useUpdateTask({ notifyOnError = false } = {}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Task) =>
      updateTask(task.id, await withStatusDetails(task)),
    // Boards move cards optimistically; refetch so a rejected or cancelled
    // move (blocked reason dismissed, in-progress limit reached) snaps back.
    onError: (error, variables) => {
      if (notifyOnError) toastTaskUpdateError(error, t("tasks:update.error"));
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.id] });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", variables.id],
      });
    },
  });
}
