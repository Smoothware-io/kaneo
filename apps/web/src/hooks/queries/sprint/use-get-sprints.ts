import { useQuery } from "@tanstack/react-query";
import getSprints from "@/fetchers/sprint/get-sprints";

export function useGetSprints(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: ["sprints", workspaceId],
    queryFn: ({ signal }) => getSprints(workspaceId, signal),
    enabled: enabled && !!workspaceId,
  });
}
