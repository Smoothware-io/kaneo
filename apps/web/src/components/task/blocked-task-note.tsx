import { OctagonAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

type BlockedTaskNoteProps = {
  reason: string;
  blockedOnName?: string | null;
  compact?: boolean;
};

export function BlockedTaskNote({
  reason,
  blockedOnName,
  compact = false,
}: BlockedTaskNoteProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex gap-2 rounded-md border border-destructive/25 bg-destructive/8 text-foreground/90",
        compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm",
      )}
    >
      <OctagonAlert
        aria-hidden="true"
        className={cn(
          "mt-0.5 shrink-0 text-destructive",
          compact ? "h-3.5 w-3.5" : "h-4 w-4",
        )}
      />
      <div className="min-w-0 space-y-0.5">
        <p className="sr-only">{t("tasks:blocked.label")}</p>
        <p
          className={cn(
            "break-words whitespace-pre-wrap",
            compact && "line-clamp-2",
          )}
        >
          {reason}
        </p>
        {blockedOnName ? (
          <p className="text-muted-foreground">
            {t("tasks:blocked.waitingOn", { name: blockedOnName })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
