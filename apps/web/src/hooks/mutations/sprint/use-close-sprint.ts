import { useMutation, useQueryClient } from "@tanstack/react-query";
import closeSprint from "@/fetchers/sprint/close-sprint";

export function useCloseSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) => closeSprint(workspaceId),
    onSettled: (_data, _error, workspaceId) => {
      queryClient.invalidateQueries({
        queryKey: ["sprint-board", workspaceId],
      });
      queryClient.invalidateQueries({ queryKey: ["sprints", workspaceId] });
      // Every project board and My Tasks lost their finished tasks.
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
