import {
  ArrowDown,
  ArrowUp,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Target,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import type { SprintGoal } from "@/fetchers/sprint/get-sprint-goals";
import {
  useDeleteSprintGoal,
  useReorderSprintGoals,
} from "@/hooks/mutations/sprint/use-sprint-goal-mutations";
import { useGetSprintGoals } from "@/hooks/queries/sprint/use-get-sprint-goals";
import { toast } from "@/lib/toast";
import SprintGoalDialog from "./sprint-goal-dialog";

type SprintGoalsPanelProps = {
  workspaceId: string;
  canEdit: boolean;
  members: { userId: string; name: string }[];
};

export default function SprintGoalsPanel({
  workspaceId,
  canEdit,
  members,
}: SprintGoalsPanelProps) {
  const { t } = useTranslation();
  const { data: goals = [], isLoading } = useGetSprintGoals(workspaceId);
  const { mutateAsync: deleteGoal } = useDeleteSprintGoal(workspaceId);
  const { mutate: reorderGoals } = useReorderSprintGoals(workspaceId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SprintGoal | null>(null);

  const totalPoints = goals.reduce((sum, goal) => sum + goal.points, 0);

  const openDialog = (goal: SprintGoal | null) => {
    setEditing(goal);
    setDialogOpen(true);
  };

  const move = (index: number, offset: number) => {
    const ids = goals.map((goal) => goal.id);
    const [moved] = ids.splice(index, 1);
    if (!moved) return;
    ids.splice(index + offset, 0, moved);
    reorderGoals(ids);
  };

  const handleDelete = async (goal: SprintGoal) => {
    try {
      await deleteGoal(goal.id);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("sprint:goals.deleteError"),
      );
    }
  };

  return (
    <section
      aria-labelledby="sprint-goals-heading"
      className="border-b border-border px-4 py-3 md:px-5"
    >
      <div className="flex items-center gap-2">
        <Target className="size-4 text-muted-foreground" />
        <h2
          id="sprint-goals-heading"
          className="text-sm font-semibold text-foreground"
        >
          {t("sprint:goals.title")}
        </h2>
        {goals.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {t("sprint:goals.totalPoints", { count: totalPoints })}
          </span>
        )}
        {canEdit && (
          <Button
            variant="ghost"
            size="xs"
            className="ml-auto"
            onClick={() => openDialog(null)}
          >
            <Plus className="size-3.5" />
            {t("sprint:goals.add")}
          </Button>
        )}
      </div>

      {isLoading ? null : goals.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t("sprint:goals.empty")}
        </p>
      ) : (
        <ul className="mt-2 grid max-h-48 gap-1 overflow-y-auto">
          {goals.map((goal, index) => (
            <li
              key={goal.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/40"
            >
              <Badge
                variant="outline"
                className="shrink-0 tabular-nums"
                title={t("sprint:goals.pointsLabel")}
              >
                {t("sprint:goals.points", { count: goal.points })}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{goal.title}</p>
                {goal.description && (
                  <p className="truncate text-xs text-muted-foreground">
                    {goal.description}
                  </p>
                )}
              </div>
              {goal.carryOverCount > 0 && (
                <Badge
                  variant="warning"
                  className="shrink-0 gap-1"
                  title={t("sprint:goals.carriedTooltip", {
                    count: goal.carryOverCount,
                  })}
                >
                  <Repeat className="size-3" />
                  {t("sprint:carriedOverBadge", { count: goal.carryOverCount })}
                </Badge>
              )}
              <span className="shrink-0 text-xs text-muted-foreground">
                {goal.ownerName ?? t("sprint:goals.noOwner")}
              </span>
              {canEdit && (
                <Menu>
                  <MenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t("sprint:goals.actions")}
                      />
                    }
                  >
                    <MoreHorizontal />
                  </MenuTrigger>
                  <MenuPopup align="end">
                    <MenuItem onClick={() => openDialog(goal)}>
                      <Pencil />
                      {t("sprint:goals.edit")}
                    </MenuItem>
                    <MenuItem
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp />
                      {t("sprint:goals.moveUp")}
                    </MenuItem>
                    <MenuItem
                      disabled={index === goals.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown />
                      {t("sprint:goals.moveDown")}
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem
                      variant="destructive"
                      onClick={() => void handleDelete(goal)}
                    >
                      <Trash2 />
                      {t("sprint:goals.delete")}
                    </MenuItem>
                  </MenuPopup>
                </Menu>
              )}
            </li>
          ))}
        </ul>
      )}

      <SprintGoalDialog
        workspaceId={workspaceId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        goal={editing}
        members={members}
      />
    </section>
  );
}
