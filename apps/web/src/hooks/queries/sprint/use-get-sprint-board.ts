import { useQuery } from "@tanstack/react-query";
import getSprintBoard from "@/fetchers/sprint/get-sprint-board";
import { isUnauthorizedError } from "@/lib/http-error";

export function useGetSprintBoard(workspaceId: string) {
  return useQuery({
    queryKey: ["sprint-board", workspaceId],
    queryFn: ({ signal }) => getSprintBoard(workspaceId, signal),
    refetchOnMount: true,
    // Matches My Tasks: the board spans projects without a single socket.
    refetchInterval: (query) =>
      isUnauthorizedError(query.state.error) ? false : 30000,
    enabled: !!workspaceId,
  });
}
