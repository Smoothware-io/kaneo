import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  RotateCw,
  Target,
  Trash2,
  X,
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
import { Progress } from "@/components/ui/progress";
import type { SprintGoal } from "@/fetchers/sprint/get-sprint-goals";
import {
  useDeleteSprintGoal,
  useReorderSprintGoals,
  useUnlinkSprintGoalTask,
} from "@/hooks/mutations/sprint/use-sprint-goal-mutations";
import { useGetSprintGoals } from "@/hooks/queries/sprint/use-get-sprint-goals";
import { cn } from "@/lib/cn";
import { getStatusLabel } from "@/lib/i18n/domain";
import { toast } from "@/lib/toast";
import { formatPoints, percentOf } from "./goal-score";
import LinkGoalTasksDialog from "./link-goal-tasks-dialog";
import SprintGoalDialog from "./sprint-goal-dialog";

type SprintGoalsPanelProps = {
  workspaceId: string;
  canEdit: boolean;
  members: { userId: string; name: string }[];
  onOpenTask: (taskId: string) => void;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function SprintGoalsPanel({
  workspaceId,
  canEdit,
  members,
  onOpenTask,
}: SprintGoalsPanelProps) {
  const { t } = useTranslation();
  const { data: goals = [], isLoading } = useGetSprintGoals(workspaceId);
  const { mutateAsync: deleteGoal } = useDeleteSprintGoal(workspaceId);
  const { mutate: reorderGoals } = useReorderSprintGoals(workspaceId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SprintGoal | null>(null);
  const [linkingGoalId, setLinkingGoalId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);

  const totalPoints = goals.reduce((sum, goal) => sum + goal.points, 0);
  // Each goal counts for the share of its linked tickets that is done.
  const earnedPoints = goals.reduce(
    (sum, goal) =>
      goal.taskCount > 0
        ? sum + (goal.points * goal.doneTaskCount) / goal.taskCount
        : sum,
    0,
  );
  const percent = percentOf(earnedPoints, totalPoints);
  const progressLabel = t("sprint:goals.overallProgress", {
    earned: formatPoints(Math.round(earnedPoints * 10) / 10),
    total: totalPoints,
    percent,
  });
  // Read from the live list so the picker reflects links as they are added.
  const linkingGoal = goals.find((goal) => goal.id === linkingGoalId) ?? null;

  const openDialog = (goal: SprintGoal | null) => {
    setEditing(goal);
    setDialogOpen(true);
  };

  const toggleExpanded = (goalId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
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
      toast.error(errorMessage(error, t("sprint:goals.deleteError")));
    }
  };

  return (
    <section
      aria-labelledby="sprint-goals-heading"
      className="border-b border-border px-4 py-3 md:px-5"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="sprint-goals-list"
          aria-label={t("sprint:goals.toggleList")}
          onClick={() => setIsOpen((open) => !open)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left"
        >
          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-90",
            )}
          />
          <Target className="size-4 shrink-0 text-muted-foreground" />
          <span
            id="sprint-goals-heading"
            className="shrink-0 text-sm font-semibold text-foreground"
          >
            {t("sprint:goals.title")}
          </span>
          {goals.length > 0 && (
            <>
              <Progress
                value={percent}
                className="min-w-24 max-w-md flex-1 gap-0"
                aria-label={progressLabel}
              />
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {progressLabel}
              </span>
            </>
          )}
        </button>
        {canEdit && (
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0"
            onClick={() => {
              setIsOpen(true);
              openDialog(null);
            }}
          >
            <Plus className="size-3.5" />
            {t("sprint:goals.add")}
          </Button>
        )}
      </div>

      {!isOpen || isLoading ? null : goals.length === 0 ? (
        <p
          id="sprint-goals-list"
          className="mt-1.5 text-xs text-muted-foreground"
        >
          {t("sprint:goals.empty")}
        </p>
      ) : (
        <ul
          id="sprint-goals-list"
          className="mt-2 grid max-h-[40vh] gap-1 overflow-y-auto"
        >
          {goals.map((goal, index) => (
            <GoalRow
              key={goal.id}
              workspaceId={workspaceId}
              goal={goal}
              canEdit={canEdit}
              expanded={expandedIds.has(goal.id)}
              onToggle={() => toggleExpanded(goal.id)}
              onOpenTask={onOpenTask}
              menu={
                canEdit && (
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
                      <MenuItem onClick={() => setLinkingGoalId(goal.id)}>
                        <Link2 />
                        {t("sprint:goals.linkTickets")}
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
                )
              }
              onLink={() => setLinkingGoalId(goal.id)}
            />
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
      <LinkGoalTasksDialog
        workspaceId={workspaceId}
        goal={linkingGoal}
        onOpenChange={(open) => {
          if (!open) setLinkingGoalId(null);
        }}
      />
    </section>
  );
}

function GoalRow({
  workspaceId,
  goal,
  canEdit,
  expanded,
  onToggle,
  onOpenTask,
  onLink,
  menu,
}: {
  workspaceId: string;
  goal: SprintGoal;
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpenTask: (taskId: string) => void;
  onLink: () => void;
  menu: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { mutateAsync: unlinkTask } = useUnlinkSprintGoalTask(workspaceId);
  const listId = `sprint-goal-tasks-${goal.id}`;

  const handleUnlink = async (taskId: string) => {
    try {
      await unlinkTask({ goalId: goal.id, taskId });
    } catch (error) {
      toast.error(errorMessage(error, t("sprint:goals.unlinkError")));
    }
  };

  return (
    <li className="rounded-md hover:bg-accent/30">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-label={t("sprint:goals.toggleTickets", { title: goal.title })}
          onClick={onToggle}
          className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronRight
            className={cn(
              "size-4 transition-transform",
              expanded && "rotate-90",
            )}
          />
        </button>
        <Badge
          variant="outline"
          className="shrink-0 tabular-nums"
          title={t("sprint:goals.pointsLabel")}
        >
          {t("sprint:goals.points", { count: goal.points })}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{goal.title}</p>
          {goal.taskCount > 0 ? (
            <div className="mt-1 flex items-center gap-2">
              <Progress
                value={(goal.doneTaskCount / goal.taskCount) * 100}
                className="w-28 gap-0"
                aria-label={t("sprint:goals.progress", {
                  done: goal.doneTaskCount,
                  total: goal.taskCount,
                })}
              />
              <span className="text-xs tabular-nums text-muted-foreground">
                {t("sprint:goals.progress", {
                  done: goal.doneTaskCount,
                  total: goal.taskCount,
                })}
              </span>
            </div>
          ) : (
            goal.description && (
              <p className="truncate text-xs text-muted-foreground">
                {goal.description}
              </p>
            )
          )}
        </div>
        {goal.repeatWeekly && (
          <Badge
            variant="info"
            className="shrink-0 gap-1"
            title={t("sprint:goals.repeatTooltip")}
          >
            <RotateCw className="size-3" />
            {t("sprint:goals.repeatBadge")}
          </Badge>
        )}
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
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {goal.ownerName ?? t("sprint:goals.noOwner")}
        </span>
        {menu}
      </div>

      {expanded && (
        <div id={listId} className="pb-2 pl-8 pr-2">
          {goal.tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("sprint:goals.noTickets")}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {goal.tasks.map((task) => (
                <li
                  key={task.id}
                  className="group/task flex items-center gap-2 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1 py-0.5 text-left hover:bg-accent/50"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        task.done ? "bg-success" : "bg-muted-foreground/40",
                      )}
                    />
                    <span className="shrink-0 font-mono text-muted-foreground">
                      {task.projectSlug}-{task.number}
                    </span>
                    <span
                      className={cn(
                        "truncate",
                        task.done
                          ? "text-muted-foreground line-through"
                          : "text-foreground",
                      )}
                    >
                      {task.title}
                    </span>
                    <span className="ml-auto shrink-0 text-muted-foreground">
                      {task.done
                        ? t("sprint:goals.ticketDone")
                        : getStatusLabel(task.status)}
                    </span>
                    <span className="hidden w-24 shrink-0 truncate text-right text-muted-foreground sm:inline">
                      {task.assigneeName ?? t("sprint:filters.unassigned")}
                    </span>
                  </button>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0 opacity-0 group-hover/task:opacity-100 focus-visible:opacity-100"
                      aria-label={t("sprint:goals.unlink", {
                        title: task.title,
                      })}
                      onClick={() => void handleUnlink(task.id)}
                    >
                      <X />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <Button variant="ghost" size="xs" className="mt-1" onClick={onLink}>
              <Link2 className="size-3.5" />
              {t("sprint:goals.linkTickets")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
