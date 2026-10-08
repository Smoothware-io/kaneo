CREATE TABLE "task_deletion" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text NOT NULL,
	"task_number" integer,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"deleted_by_id" text,
	"deleted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_member" (
	"task_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_member_task_id_user_id_pk" PRIMARY KEY("task_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "task_deletion" ADD CONSTRAINT "task_deletion_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_deletion" ADD CONSTRAINT "task_deletion_deleted_by_id_user_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_member" ADD CONSTRAINT "task_member_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_member" ADD CONSTRAINT "task_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_deletion_projectId_deletedAt_idx" ON "task_deletion" USING btree ("project_id","deleted_at");--> statement-breakpoint
CREATE INDEX "task_member_userId_idx" ON "task_member" USING btree ("user_id");--> statement-breakpoint
-- Tasks archived before archived_at existed: their last update is the best
-- available approximation of when they were archived.
UPDATE "task" SET "archived_at" = "updated_at" WHERE "status" = 'archived' AND "archived_at" IS NULL;
