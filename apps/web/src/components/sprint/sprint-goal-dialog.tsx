import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { SprintGoal } from "@/fetchers/sprint/get-sprint-goals";
import {
  useCreateSprintGoal,
  useUpdateSprintGoal,
} from "@/hooks/mutations/sprint/use-sprint-goal-mutations";
import { toast } from "@/lib/toast";

const NO_OWNER = "none";

type SprintGoalDialogProps = {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Edits this goal when given, otherwise creates a new one.
  goal?: SprintGoal | null;
  members: { userId: string; name: string }[];
};

export default function SprintGoalDialog(props: SprintGoalDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-md">
        {/* Remounted per open so the form starts from the goal's values. */}
        {props.open && <SprintGoalForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function SprintGoalForm({
  workspaceId,
  onOpenChange,
  goal,
  members,
}: SprintGoalDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [points, setPoints] = useState(String(goal?.points ?? 1));
  const [ownerId, setOwnerId] = useState(goal?.ownerId ?? NO_OWNER);
  const [repeatWeekly, setRepeatWeekly] = useState(goal?.repeatWeekly ?? false);
  const { mutateAsync: createGoal, isPending: isCreating } =
    useCreateSprintGoal(workspaceId);
  const { mutateAsync: updateGoal, isPending: isUpdating } =
    useUpdateSprintGoal(workspaceId);

  const parsedPoints = Number(points);
  const isValid =
    title.trim().length > 0 &&
    Number.isInteger(parsedPoints) &&
    parsedPoints >= 1 &&
    parsedPoints <= 100;

  const ownerItems: Record<string, string> = {
    [NO_OWNER]: t("sprint:goals.noOwner"),
  };
  for (const member of members) ownerItems[member.userId] = member.name;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;
    const fields = {
      title: title.trim(),
      description: description.trim() || null,
      points: parsedPoints,
      ownerId: ownerId === NO_OWNER ? null : ownerId,
      repeatWeekly,
    };
    try {
      if (goal) {
        await updateGoal({ goalId: goal.id, patch: fields });
      } else {
        await createGoal(fields);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("sprint:goals.saveError"),
      );
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {goal ? t("sprint:goals.editTitle") : t("sprint:goals.addTitle")}
        </DialogTitle>
        <DialogDescription>
          {t("sprint:goals.dialogDescription")}
        </DialogDescription>
      </DialogHeader>
      <DialogPanel className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sprint-goal-title">
            {t("sprint:goals.titleLabel")}
          </Label>
          <Input
            id="sprint-goal-title"
            value={title}
            maxLength={200}
            autoFocus
            placeholder={t("sprint:goals.titlePlaceholder")}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sprint-goal-description">
            {t("sprint:goals.descriptionLabel")}
          </Label>
          <Textarea
            id="sprint-goal-description"
            value={description}
            maxLength={2000}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <div className="w-24 space-y-1.5">
            <Label htmlFor="sprint-goal-points">
              {t("sprint:goals.pointsLabel")}
            </Label>
            <Input
              id="sprint-goal-points"
              type="number"
              min={1}
              max={100}
              step={1}
              value={points}
              onChange={(event) => setPoints(event.target.value)}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label>{t("sprint:goals.ownerLabel")}</Label>
            <Select
              items={ownerItems}
              value={ownerId}
              onValueChange={(value) =>
                setOwnerId(typeof value === "string" ? value : NO_OWNER)
              }
            >
              <SelectTrigger aria-label={t("sprint:goals.ownerLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {Object.entries(ownerItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Switch
            id="sprint-goal-repeat"
            checked={repeatWeekly}
            onCheckedChange={setRepeatWeekly}
          />
          <div className="space-y-0.5">
            <Label htmlFor="sprint-goal-repeat">
              {t("sprint:goals.repeatLabel")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("sprint:goals.repeatHint")}
            </p>
          </div>
        </div>
      </DialogPanel>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
        >
          {t("common:actions.cancel")}
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!isValid || isCreating || isUpdating}
        >
          {goal ? t("sprint:goals.save") : t("sprint:goals.add")}
        </Button>
      </DialogFooter>
    </form>
  );
}
