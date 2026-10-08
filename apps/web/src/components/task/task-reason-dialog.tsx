import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MAX_REASON_LENGTH } from "@/constants/task-workflow";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import useTaskReasonPromptStore from "@/store/task-reason-prompt";

const NOBODY = "none";

type TaskReasonDialogProps = {
  workspaceId: string | undefined;
};

export default function TaskReasonDialog({
  workspaceId,
}: TaskReasonDialogProps) {
  const { t } = useTranslation();
  const current = useTaskReasonPromptStore((state) => state.queue[0]);
  const settle = useTaskReasonPromptStore((state) => state.settle);
  const [reason, setReason] = useState("");
  const [blockedOnUserId, setBlockedOnUserId] = useState(NOBODY);
  const kind = current?.kind;
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
    kind === "blocked" ? (workspaceId ?? "") : "",
  );

  // Each queued prompt starts from that task's current details, if any.
  useEffect(() => {
    setReason(current?.target.reason ?? "");
    setBlockedOnUserId(current?.target.blockedOnUserId ?? NOBODY);
  }, [current]);

  const memberItems = useMemo(() => {
    const items: Record<string, string> = {
      [NOBODY]: t("tasks:blocked.dialog.nobody"),
    };
    for (const member of workspaceUsers?.members ?? []) {
      items[member.userId] = member.user?.name ?? member.userId;
    }
    return items;
  }, [t, workspaceUsers]);

  const copy = useMemo(() => {
    const title = current?.target.title ?? "";
    const count = current?.target.count;
    switch (kind) {
      case "cancel":
        return {
          title: t("tasks:cancel.dialog.title"),
          description: t("tasks:cancel.dialog.description", { title }),
          reasonLabel: t("tasks:cancel.dialog.reasonLabel"),
          placeholder: t("tasks:cancel.dialog.reasonPlaceholder"),
          submit: t("tasks:cancel.dialog.submit"),
        };
      case "delete":
        return {
          title: t("tasks:delete.title"),
          description: count
            ? t("tasks:delete.reasonDialog.bulkDescription", { count })
            : t("tasks:delete.reasonDialog.description", { title }),
          reasonLabel: t("tasks:delete.reasonDialog.reasonLabel"),
          placeholder: t("tasks:delete.reasonDialog.reasonPlaceholder"),
          submit: t("tasks:delete.action"),
        };
      default:
        return {
          title: t("tasks:blocked.dialog.title"),
          description: t("tasks:blocked.dialog.description", { title }),
          reasonLabel: t("tasks:blocked.dialog.reasonLabel"),
          placeholder: t("tasks:blocked.dialog.reasonPlaceholder"),
          submit: t("tasks:blocked.dialog.submit"),
        };
    }
  }, [current, kind, t]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) return;

    settle({
      reason: trimmed,
      blockedOnUserId:
        kind === "blocked" && blockedOnUserId !== NOBODY
          ? blockedOnUserId
          : null,
    });
  };

  return (
    <Dialog
      open={Boolean(current)}
      onOpenChange={(open) => {
        if (!open) settle(null);
      }}
    >
      <DialogPopup className="sm:max-w-md">
        <form className="contents" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="task-reason">
                  {copy.reasonLabel}
                </FieldLabel>
                <Textarea
                  id="task-reason"
                  name="reason"
                  required
                  autoFocus
                  rows={4}
                  maxLength={MAX_REASON_LENGTH}
                  placeholder={copy.placeholder}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </Field>
              {kind === "blocked" && (
                <Field>
                  <FieldLabel htmlFor="task-reason-user">
                    {t("tasks:blocked.dialog.userLabel")}
                  </FieldLabel>
                  <Select
                    items={memberItems}
                    value={blockedOnUserId}
                    onValueChange={(value) =>
                      setBlockedOnUserId(
                        typeof value === "string" ? value : NOBODY,
                      )
                    }
                  >
                    <SelectTrigger id="task-reason-user">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      {Object.entries(memberItems).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t("tasks:blocked.dialog.userHint")}
                  </p>
                </Field>
              )}
            </div>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              {t("common:actions.cancel")}
            </DialogClose>
            <Button
              type="submit"
              variant={kind === "delete" ? "destructive" : "default"}
              disabled={!reason.trim()}
            >
              {copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
