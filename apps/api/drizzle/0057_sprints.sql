CREATE TABLE "sprint" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"week_year" integer NOT NULL,
	"week" integer NOT NULL,
	"closed_at" timestamp DEFAULT now() NOT NULL,
	"closed_by_id" text,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"carried_over_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "sprint_id" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "carry_over_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sprint" ADD CONSTRAINT "sprint_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sprint" ADD CONSTRAINT "sprint_closed_by_id_user_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "sprint_workspaceId_closedAt_idx" ON "sprint" USING btree ("workspace_id","closed_at");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_sprint_id_sprint_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprint"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_sprintId_idx" ON "task" USING btree ("sprint_id");