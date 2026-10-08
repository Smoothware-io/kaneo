import { format } from "date-fns";
import { ChevronRight, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGetTaskDeletions } from "@/hooks/queries/task/use-get-task-deletions";
import { cn } from "@/lib/cn";

type BacklogDeletedSectionProps = {
  projectId: string;
  projectSlug: string;
  isExpanded: boolean;
  onToggle: (sectionId: string) => void;
};

/** Read-only log of deleted tasks, so a deletion and its reason stay traceable. */
export default function BacklogDeletedSection({
  projectId,
  projectSlug,
  isExpanded,
  onToggle,
}: BacklogDeletedSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="border-b border-border/50">
      <div className="flex items-center py-2 px-4 bg-muted/60 border-b border-border/50">
        <button
          type="button"
          onClick={() => onToggle("deleted")}
          aria-expanded={isExpanded}
          className="flex items-center gap-2 text-sm font-medium text-foreground"
        >
          <ChevronRight
            className={cn(
              "w-3 h-3 transition-transform",
              isExpanded && "rotate-90",
            )}
          />
          <Trash2 className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
          <span>{t("tasks:backlog.sections.deleted")}</span>
        </button>
      </div>

      {isExpanded && (
        <DeletedTaskList projectId={projectId} projectSlug={projectSlug} />
      )}
    </div>
  );
}

// Mounted only while expanded, so the log is fetched on demand.
function DeletedTaskList({
  projectId,
  projectSlug,
}: {
  projectId: string;
  projectSlug: string;
}) {
  const { t } = useTranslation();
  const { data: deletions = [], isLoading } = useGetTaskDeletions(projectId);

  return (
    <div className="bg-card">
      {isLoading ? (
        <div className="py-6 px-4 text-center text-xs text-muted-foreground">
          {t("common:empty.loading")}
        </div>
      ) : deletions.length === 0 ? (
        <div className="py-6 px-4 text-center text-xs text-muted-foreground">
          {t("tasks:backlog.noDeletedTasks")}
        </div>
      ) : (
        <ul className="divide-y divide-border/40">
          {deletions.map((deletion) => (
            <li key={deletion.id} className="px-4 py-2.5 text-sm">
              <div className="flex items-baseline gap-2">
                {deletion.taskNumber !== null && (
                  <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                    {projectSlug}-{deletion.taskNumber}
                  </span>
                )}
                <span className="truncate text-foreground line-through decoration-muted-foreground/50">
                  {deletion.title}
                </span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-foreground/80">
                {deletion.reason}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("tasks:backlog.deletedBy", {
                  name:
                    deletion.deletedByName ?? t("tasks:backlog.unknownUser"),
                  date: format(new Date(deletion.deletedAt), "PPp"),
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
