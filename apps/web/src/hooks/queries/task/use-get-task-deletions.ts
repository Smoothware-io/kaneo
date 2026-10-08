import { useQuery } from "@tanstack/react-query";
import getTaskDeletions from "@/fetchers/task/get-task-deletions";

export function useGetTaskDeletions(projectId: string) {
  return useQuery({
    queryKey: ["task-deletions", projectId],
    queryFn: ({ signal }) => getTaskDeletions(projectId, signal),
    enabled: !!projectId,
  });
}
