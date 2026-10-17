import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Toggle, ToggleGroup } from "@/components/ui/toggle-group";
import type { SprintGoalOutcome } from "@/fetchers/sprint/close-sprint";
import type { SprintGoal } from "@/fetchers/sprint/get-sprint-goals";
import { formatPoints, goalScore, suggestedResult } from "./goal-score";

type GoalResult = SprintGoalOutcome["result"];

const RESULTS: GoalResult[] = ["fully", "half", "none"];

type CloseSprintDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  week: number;
  finishedCount: number;
  openCount: number;
  goals: SprintGoal[];
  isClosing: boolean;
  onConfirm: (goals: SprintGoalOutcome[]) => void;
};

export default function CloseSprintDialog(props: CloseSprintDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        {/* Remounted per open so every close starts unscored. */}
        {props.open && <CloseSprintForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function CloseSprintForm({
  onOpenChange,
  week,
  finishedCount,
  openCount,
  goals,
  isClosing,
  onConfirm,
}: CloseSprintDialogProps) {
  const { t } = useTranslation();
  // Start from what the linked tickets say; goals without tickets start empty.
  const [results, setResults] = useState<Record<string, GoalResult>>(() => {
    const initial: Record<string, GoalResult> = {};
    for (const goal of goals) {
      const suggestion = suggestedResult(goal);
      if (suggestion) initial[goal.id] = suggestion;
    }
    return initial;
  });
  const [carryOver, setCarryOver] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const [goalId, result] of Object.entries(results)) {
      initial[goalId] = result !== "fully";
    }
    return initial;
  });

  const score = goalScore(
    goals.map((goal) => ({
      points: goal.points,
      result: results[goal.id] ?? null,
    })),
  );
  const allScored = goals.every((goal) => results[goal.id]);

  const setResult = (goalId: string, result: GoalResult) => {
    setResults((current) => ({ ...current, [goalId]: result }));
    // Reached goals are done; anything short of that rolls on by default.
    setCarryOver((current) => ({ ...current, [goalId]: result !== "fully" }));
  };

  const handleConfirm = () => {
    onConfirm(
      goals.flatMap((goal) => {
        const result = results[goal.id];
        return result
          ? [{ goalId: goal.id, result, carryOver: !!carryOver[goal.id] }]
          : [];
      }),
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("sprint:close.title", { week })}</DialogTitle>
        <DialogDescription>
          {t("sprint:close.description", {
            finished: finishedCount,
            open: openCount,
          })}
        </DialogDescription>
      </DialogHeader>
      {goals.length > 0 && (
        <DialogPanel className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              {t("sprint:close.goalsHeading")}
            </p>
            <p
              className="text-sm tabular-nums text-muted-foreground"
              aria-live="polite"
            >
              {t("sprint:goals.score", {
                earned: formatPoints(score.earned),
                total: score.total,
                percent: score.percent,
              })}
            </p>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {goals.map((goal) => {
              const result = results[goal.id];
              const carryId = `carry-${goal.id}`;
              return (
                <li key={goal.id} className="space-y-2 px-3 py-2.5">
                  <div className="flex items-baseline gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {goal.title}
                    </p>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {t("sprint:goals.points", { count: goal.points })}
                    </span>
                  </div>
                  {(goal.taskCount > 0 || goal.repeatWeekly) && (
                    <p className="text-xs text-muted-foreground">
                      {goal.taskCount > 0 &&
                        t("sprint:close.suggestion", {
                          done: goal.doneTaskCount,
                          total: goal.taskCount,
                          result: t(
                            `sprint:goals.result.${suggestedResult(goal) ?? "none"}`,
                          ),
                        })}
                      {goal.taskCount > 0 && goal.repeatWeekly && " · "}
                      {goal.repeatWeekly && t("sprint:close.repeats")}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <ToggleGroup
                      variant="outline"
                      size="sm"
                      aria-label={t("sprint:close.resultLabel", {
                        title: goal.title,
                      })}
                      value={result ? [result] : []}
                      onValueChange={(value) => {
                        const next = value[0] as GoalResult | undefined;
                        if (next) setResult(goal.id, next);
                      }}
                    >
                      {RESULTS.map((option) => (
                        <Toggle key={option} value={option}>
                          {t(`sprint:goals.result.${option}`)}
                        </Toggle>
                      ))}
                    </ToggleGroup>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={carryId}
                        checked={!!carryOver[goal.id]}
                        onCheckedChange={(checked) =>
                          setCarryOver((current) => ({
                            ...current,
                            [goal.id]: checked === true,
                          }))
                        }
                      />
                      <Label htmlFor={carryId} className="text-xs font-normal">
                        {t("sprint:close.carryOver")}
                      </Label>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {!allScored && (
            <p className="text-xs text-muted-foreground">
              {t("sprint:close.scoreEveryGoal")}
            </p>
          )}
        </DialogPanel>
      )}
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          {t("common:actions.cancel")}
        </Button>
        <Button
          size="sm"
          disabled={!allScored || isClosing}
          onClick={handleConfirm}
        >
          {t("sprint:close.confirm")}
        </Button>
      </DialogFooter>
    </>
  );
}
