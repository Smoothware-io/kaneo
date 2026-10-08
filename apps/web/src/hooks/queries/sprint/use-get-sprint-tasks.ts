import { useQuery } from "@tanstack/react-query";
import getSprintTasks from "@/fetchers/sprint/get-sprint-tasks";

export function useGetSprintTasks(workspaceId: string, sprintId: string) {
  return useQuery({
    queryKey: ["sprint-tasks", workspaceId, sprintId],
    queryFn: ({ signal }) => getSprintTasks(workspaceId, sprintId, signal),
    enabled: !!workspaceId && !!sprintId,
  });
}
