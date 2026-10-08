import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTask from "@/fetchers/task/delete-task";
import { requestDeleteReason } from "@/lib/task-reason";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import { removeTaskFromProject } from "./remove-task-from-project";

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    // Without a reason given up front, ask for one; the prompt also serves as
    // the confirmation step.
    mutationFn: async ({
      id,
      title,
      reason,
    }: {
      id: string;
      title: string;
      reason?: string;
    }) => deleteTask(id, reason ?? (await requestDeleteReason({ title }))),
    onSuccess: (deletedTask) => {
      queryClient.setQueryData<ProjectWithTasks | undefined>(
        ["tasks", deletedTask.projectId],
        (project) =>
          project ? removeTaskFromProject(project, deletedTask.id) : project,
      );
      queryClient.removeQueries({
        queryKey: ["task", deletedTask.id],
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: ["tasks", deletedTask.projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["task-deletions", deletedTask.projectId],
      });

      const { project, setProject } = useProjectStore.getState();
      if (project?.id === deletedTask.projectId) {
        setProject(removeTaskFromProject(project, deletedTask.id));
      }
    },
  });
}
