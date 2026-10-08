import { useMutation, useQueryClient } from "@tanstack/react-query";
import archiveCompleted from "@/fetchers/task/archive-completed";

export function useArchiveCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => archiveCompleted(projectId),
    onSettled: (_data, _error, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
