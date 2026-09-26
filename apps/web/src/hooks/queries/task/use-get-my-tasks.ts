import { useQuery } from "@tanstack/react-query";
import getMyTasks from "@/fetchers/task/get-my-tasks";
import { isUnauthorizedError } from "@/lib/http-error";

export function useGetMyTasks(workspaceId: string) {
  return useQuery({
    queryKey: ["my-tasks", workspaceId],
    queryFn: ({ signal }) => getMyTasks(workspaceId, signal),
    refetchOnMount: true,
    refetchInterval: (query) =>
      isUnauthorizedError(query.state.error) ? false : 30000,
    enabled: !!workspaceId,
  });
}
