import { Check } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskMembers } from "@/hooks/mutations/task/use-update-task-members";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getInitials } from "@/lib/get-initials";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskMembersPopoverProps = {
  task: Task;
  workspaceId: string;
  children: React.ReactNode;
};

/**
 * Multi-select for the team members on a task. The responsible person is the
 * assignee and is chosen separately.
 */
export default function TaskMembersPopover({
  task,
  workspaceId,
  children,
}: TaskMembersPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTaskMembers, isPending } = useUpdateTaskMembers();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { canAssignTasks } = useWorkspacePermission();
  const memberIds = useMemo(() => task.memberIds ?? [], [task.memberIds]);

  const users = useMemo(
    () =>
      workspaceUsers?.members?.map((member) => ({
        id: member.userId,
        name: member.user?.name ?? member.userId,
        image: member.user?.image ?? "",
      })) ?? [],
    [workspaceUsers],
  );

  const toggleMember = useCallback(
    async (userId: string) => {
      const next = memberIds.includes(userId)
        ? memberIds.filter((id) => id !== userId)
        : [...memberIds, userId];
      try {
        await updateTaskMembers({ task, userIds: next });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:popover.members.updateError"),
        );
      }
    },
    [memberIds, t, task, updateTaskMembers],
  );

  if (!canAssignTasks()) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <div className="max-h-80 space-y-1 overflow-y-auto p-1">
          {users.map((user) => {
            const selected = memberIds.includes(user.id);
            return (
              <Button
                key={user.id}
                variant="ghost"
                size="sm"
                disabled={isPending}
                aria-pressed={selected}
                className="w-full justify-start gap-2 h-8 px-2"
                onClick={() => void toggleMember(user.id)}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.image} alt={user.name} />
                  <AvatarFallback className="text-xs font-medium border border-border/30">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm truncate">{user.name}</span>
                {user.id === task.userId && (
                  <span className="text-[10px] text-muted-foreground">
                    {t("tasks:popover.members.responsible")}
                  </span>
                )}
                {selected && <Check className="ml-auto h-4 w-4 shrink-0" />}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
