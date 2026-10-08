import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import { withStatusDetails } from "@/lib/task-reason";
import type Task from "@/types/task";

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Task) =>
      updateTaskStatus(task.id, await withStatusDetails(task)),
    // Boards move cards optimistically; refetch so a rejected or cancelled
    // move (blocked reason dismissed, in-progress limit reached) snaps back.
    onError: (_error, variables) => {
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
      queryClient.invalidateQueries({
        queryKey: ["task-relations"],
      });
    },
  });
}
