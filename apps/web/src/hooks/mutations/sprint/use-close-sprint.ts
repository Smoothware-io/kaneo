import { useMutation, useQueryClient } from "@tanstack/react-query";
import closeSprint, {
  type SprintGoalOutcome,
} from "@/fetchers/sprint/close-sprint";

export function useCloseSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      goals,
    }: {
      workspaceId: string;
      goals: SprintGoalOutcome[];
    }) => closeSprint(workspaceId, goals),
    onSettled: (_data, _error, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: ["sprint-board", workspaceId],
      });
      queryClient.invalidateQueries({ queryKey: ["sprints", workspaceId] });
      queryClient.invalidateQueries({
        queryKey: ["sprint-goals", workspaceId],
      });
      // Every project board and My Tasks lost their finished tasks.
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
