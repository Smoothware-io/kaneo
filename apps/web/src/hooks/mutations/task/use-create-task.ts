import { useMutation, useQueryClient } from "@tanstack/react-query";
import createTask, {
  type CreateTaskRequest,
} from "@/fetchers/task/create-task";
import { requestStatusDetailsForNewTask } from "@/lib/task-reason";

function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      title,
      description,
      userId,
      projectId,
      status,
      startDate,
      dueDate,
      priority,
      customFields,
      blockedReason,
      blockedOnUserId,
      cancelReason,
    }: CreateTaskRequest) =>
      createTask(
        title,
        description,
        projectId,
        userId,
        status,
        startDate ? new Date(startDate) : undefined,
        dueDate ? new Date(dueDate) : undefined,
        priority,
        customFields,
        blockedReason || cancelReason
          ? { blockedReason, blockedOnUserId, cancelReason }
          : await requestStatusDetailsForNewTask(status, title),
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["custom-field-values", variables.projectId],
      });
    },
  });
}

export default useCreateTask;
