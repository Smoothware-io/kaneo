CREATE TABLE "sprint_goal" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"owner_id" text,
	"points" integer DEFAULT 1 NOT NULL,
	"result" text,
	"sprint_id" text,
	"carried_from_goal_id" text,
	"carry_over_count" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sprint" ADD COLUMN "goal_points_earned" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sprint" ADD COLUMN "goal_points_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sprint_goal" ADD CONSTRAINT "sprint_goal_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sprint_goal" ADD CONSTRAINT "sprint_goal_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sprint_goal" ADD CONSTRAINT "sprint_goal_sprint_id_sprint_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprint"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sprint_goal" ADD CONSTRAINT "sprint_goal_carried_from_goal_id_sprint_goal_id_fk" FOREIGN KEY ("carried_from_goal_id") REFERENCES "public"."sprint_goal"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "sprint_goal_workspaceId_sprintId_idx" ON "sprint_goal" USING btree ("workspace_id","sprint_id");--> statement-breakpoint
CREATE INDEX "sprint_goal_sprintId_idx" ON "sprint_goal" USING btree ("sprint_id");