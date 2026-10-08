import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetTitle,
} from "@/components/ui/sheet";
import { useGetSprintTasks } from "@/hooks/queries/sprint/use-get-sprint-tasks";
import { useGetSprints } from "@/hooks/queries/sprint/use-get-sprints";
import { cn } from "@/lib/cn";

type SprintHistorySheetProps = {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function SprintHistorySheet({
  workspaceId,
  open,
  onOpenChange,
}: SprintHistorySheetProps) {
  const { t } = useTranslation();
  const { data: sprints = [], isLoading } = useGetSprints(workspaceId, open);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("sprint:history.title")}</SheetTitle>
          <SheetDescription>{t("sprint:history.description")}</SheetDescription>
        </SheetHeader>
        <SheetPanel>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              {t("common:empty.loading")}
            </p>
          ) : sprints.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("sprint:history.empty")}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {sprints.map((sprint) => {
                const expanded = expandedId === sprint.id;
                return (
                  <li key={sprint.id}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedId(expanded ? null : sprint.id)}
                      className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-accent/40"
                    >
                      <ChevronRight
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          expanded && "rotate-90",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {t("sprint:weekLabel", {
                            week: sprint.week,
                            year: sprint.weekYear,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("sprint:history.closedBy", {
                            name:
                              sprint.closedByName ??
                              t("sprint:history.unknown"),
                            date: format(new Date(sprint.closedAt), "PPp"),
                          })}
                        </p>
                        <p className="mt-1 text-xs text-foreground/80">
                          {t("sprint:history.counts", {
                            completed: sprint.completedCount,
                            carried: sprint.carriedOverCount,
                          })}
                        </p>
                      </div>
                    </button>
                    {expanded && (
                      <SprintTaskList
                        workspaceId={workspaceId}
                        sprintId={sprint.id}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SheetPanel>
      </SheetContent>
    </Sheet>
  );
}

// Mounted only when a sprint is expanded, so its tasks load on demand.
function SprintTaskList({
  workspaceId,
  sprintId,
}: {
  workspaceId: string;
  sprintId: string;
}) {
  const { t } = useTranslation();
  const { data: tasks = [], isLoading } = useGetSprintTasks(
    workspaceId,
    sprintId,
  );

  if (isLoading) {
    return (
      <p className="px-9 pb-3 text-xs text-muted-foreground">
        {t("common:empty.loading")}
      </p>
    );
  }

  if (tasks.length === 0) {
    return (
      <p className="px-9 pb-3 text-xs text-muted-foreground">
        {t("sprint:history.noTasks")}
      </p>
    );
  }

  return (
    <ul className="space-y-1 px-9 pb-3">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-baseline gap-2 text-xs">
          <span className="shrink-0 font-mono text-muted-foreground">
            {task.projectSlug}-{task.number}
          </span>
          <span className="truncate text-foreground">{task.title}</span>
          {task.assigneeName && (
            <span className="ml-auto shrink-0 text-muted-foreground">
              {task.assigneeName}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
