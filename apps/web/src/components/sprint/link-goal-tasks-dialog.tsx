import { Check, Plus, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SprintGoal } from "@/fetchers/sprint/get-sprint-goals";
import { useLinkSprintGoalTasks } from "@/hooks/mutations/sprint/use-sprint-goal-mutations";
import useGlobalSearch from "@/hooks/queries/search/use-global-search";
import { toast } from "@/lib/toast";

type LinkGoalTasksDialogProps = {
  workspaceId: string;
  goal: SprintGoal | null;
  onOpenChange: (open: boolean) => void;
};

export default function LinkGoalTasksDialog({
  workspaceId,
  goal,
  onOpenChange,
}: LinkGoalTasksDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={!!goal} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("sprint:goals.linkTitle")}</DialogTitle>
          <DialogDescription>
            {goal
              ? t("sprint:goals.linkDescription", { title: goal.title })
              : null}
          </DialogDescription>
        </DialogHeader>
        {goal && <TaskSearch workspaceId={workspaceId} goal={goal} />}
      </DialogContent>
    </Dialog>
  );
}

function TaskSearch({
  workspaceId,
  goal,
}: {
  workspaceId: string;
  goal: SprintGoal;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const { data, isFetching } = useGlobalSearch({
    q: deferredQuery,
    type: "tasks",
    workspaceId,
    limit: 20,
  });
  const { mutateAsync: linkTasks, isPending } =
    useLinkSprintGoalTasks(workspaceId);
  const linkedIds = new Set(goal.tasks.map((task) => task.id));
  const results = (data?.results ?? []).filter(
    (result) => result.type === "task",
  );

  const handleLink = async (taskId: string) => {
    try {
      await linkTasks({ goalId: goal.id, taskIds: [taskId] });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("sprint:goals.linkError"),
      );
    }
  };

  return (
    <DialogPanel className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          className="pl-8"
          placeholder={t("sprint:goals.searchPlaceholder")}
          aria-label={t("sprint:goals.searchPlaceholder")}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {deferredQuery.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("sprint:goals.searchHint")}
        </p>
      ) : results.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {isFetching
            ? t("common:empty.loading")
            : t("sprint:goals.searchEmpty")}
        </p>
      ) : (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {results.map((result) => {
            const linked = linkedIds.has(result.id);
            return (
              <li
                key={result.id}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {result.projectSlug}-{result.taskNumber}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {result.title}
                </span>
                <Button
                  variant={linked ? "ghost" : "outline"}
                  size="xs"
                  disabled={linked || isPending}
                  onClick={() => void handleLink(result.id)}
                >
                  {linked ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  {linked
                    ? t("sprint:goals.linked")
                    : t("sprint:goals.linkAction")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </DialogPanel>
  );
}
