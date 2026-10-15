import { useQuery } from "@tanstack/react-query";
import getSprintGoals from "@/fetchers/sprint/get-sprint-goals";
import { isUnauthorizedError } from "@/lib/http-error";

export function useGetSprintGoals(workspaceId: string) {
  return useQuery({
    queryKey: ["sprint-goals", workspaceId],
    queryFn: ({ signal }) => getSprintGoals(workspaceId, signal),
    // Same cadence as the sprint board; goals have no socket either.
    refetchInterval: (query) =>
      isUnauthorizedError(query.state.error) ? false : 30000,
    enabled: !!workspaceId,
  });
}
