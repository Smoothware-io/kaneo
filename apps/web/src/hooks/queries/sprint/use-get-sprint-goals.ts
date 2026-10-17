import { useQuery } from "@tanstack/react-query";
import getSprintGoals from "@/fetchers/sprint/get-sprint-goals";
import { isUnauthorizedError } from "@/lib/http-error";

export function useGetSprintGoals(workspaceId: string, { poll = true } = {}) {
  return useQuery({
    queryKey: ["sprint-goals", workspaceId],
    queryFn: ({ signal }) => getSprintGoals(workspaceId, signal),
    // Same cadence as the sprint board; goals have no socket either.
    refetchInterval: (query) =>
      poll && !isUnauthorizedError(query.state.error) ? 30000 : false,
    enabled: !!workspaceId,
  });
}
