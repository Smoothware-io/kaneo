import { useMutation, useQueryClient } from "@tanstack/react-query";
import createSprintGoal, {
  type SprintGoalInput,
} from "@/fetchers/sprint/create-sprint-goal";
import deleteSprintGoal from "@/fetchers/sprint/delete-sprint-goal";
import reorderSprintGoals from "@/fetchers/sprint/reorder-sprint-goals";
import updateSprintGoal, {
  type SprintGoalPatch,
} from "@/fetchers/sprint/update-sprint-goal";

function useInvalidateGoals(workspaceId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: ["sprint-goals", workspaceId] });
}

export function useCreateSprintGoal(workspaceId: string) {
  const invalidate = useInvalidateGoals(workspaceId);
  return useMutation({
    mutationFn: (goal: SprintGoalInput) => createSprintGoal(workspaceId, goal),
    onSettled: invalidate,
  });
}

export function useUpdateSprintGoal(workspaceId: string) {
  const invalidate = useInvalidateGoals(workspaceId);
  return useMutation({
    mutationFn: ({
      goalId,
      patch,
    }: {
      goalId: string;
      patch: SprintGoalPatch;
    }) => updateSprintGoal(workspaceId, goalId, patch),
    onSettled: invalidate,
  });
}

export function useDeleteSprintGoal(workspaceId: string) {
  const invalidate = useInvalidateGoals(workspaceId);
  return useMutation({
    mutationFn: (goalId: string) => deleteSprintGoal(workspaceId, goalId),
    onSettled: invalidate,
  });
}

export function useReorderSprintGoals(workspaceId: string) {
  const invalidate = useInvalidateGoals(workspaceId);
  return useMutation({
    mutationFn: (goalIds: string[]) => reorderSprintGoals(workspaceId, goalIds),
    onSettled: invalidate,
  });
}
