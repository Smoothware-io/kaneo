import { Link } from "@tanstack/react-router";
import { getISOWeek } from "date-fns";
import { Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { useGetSprintGoals } from "@/hooks/queries/sprint/use-get-sprint-goals";

/** The open sprint goals a task is needed for, linking to the Sprint board. */
export default function TaskGoalBadges({
  workspaceId,
  taskId,
}: {
  workspaceId: string;
  taskId: string;
}) {
  const { t } = useTranslation();
  const { data: goals = [] } = useGetSprintGoals(workspaceId, {
    poll: false,
  });
  const linked = goals.filter((goal) =>
    goal.tasks.some((task) => task.id === taskId),
  );
  if (linked.length === 0) return null;

  const week = getISOWeek(new Date());
  return (
    <div className="flex flex-wrap gap-1.5">
      {linked.map((goal) => (
        <Badge
          key={goal.id}
          variant="info"
          className="max-w-full gap-1"
          render={
            <Link
              to="/dashboard/workspace/$workspaceId/sprint"
              params={{ workspaceId }}
            />
          }
        >
          <Target className="size-3 shrink-0" />
          <span className="truncate">
            {t("sprint:goals.taskBadge", { week, title: goal.title })}
          </span>
        </Badge>
      ))}
    </div>
  );
}
