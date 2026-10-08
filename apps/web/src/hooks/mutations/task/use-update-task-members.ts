import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskMembers from "@/fetchers/task/update-task-members";
import type Task from "@/types/task";

export function useUpdateTaskMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ task, userIds }: { task: Task; userIds: string[] }) =>
      updateTaskMembers(task.id, userIds),
    onSuccess: (_, { task }) => {
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["activities", task.id] });
    },
  });
}
