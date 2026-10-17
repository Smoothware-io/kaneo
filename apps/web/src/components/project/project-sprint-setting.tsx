import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import useUpdateProject from "@/hooks/mutations/project/use-update-project";
import useGetProject from "@/hooks/queries/project/use-get-project";
import { toast } from "@/lib/toast";

type ProjectSprintSettingProps = {
  projectId: string;
  workspaceId: string;
  canEdit: boolean;
};

/** Opts a project in or out of the workspace's weekly sprint. */
export default function ProjectSprintSetting({
  projectId,
  workspaceId,
  canEdit,
}: ProjectSprintSettingProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { mutateAsync: updateProject } = useUpdateProject();
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (inSprint: boolean) => {
    if (!project || isSaving) return;
    setIsSaving(true);
    try {
      await updateProject({
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description ?? "",
        icon: project.icon ?? "Layout",
        isPublic: !!project.isPublic,
        inSprint,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({
          queryKey: ["sprint-board", workspaceId],
        }),
      ]);
      toast.success(
        inSprint
          ? t("settings:projectGeneral.sprintIncludedToast")
          : t("settings:projectGeneral.sprintExcludedToast"),
      );
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:projectGeneral.sprintUpdateError"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-md font-medium">
          {t("settings:projectGeneral.sprintTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("settings:projectGeneral.sprintSubtitle")}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-sidebar p-4">
        <div className="space-y-0.5">
          <Label htmlFor="project-in-sprint" className="text-sm font-medium">
            {t("settings:projectGeneral.inSprintLabel")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("settings:projectGeneral.inSprintHint")}
          </p>
        </div>
        <Switch
          id="project-in-sprint"
          checked={project?.inSprint ?? true}
          disabled={!canEdit || !project || isSaving}
          onCheckedChange={(checked) => void handleChange(checked)}
        />
      </div>
    </div>
  );
}
