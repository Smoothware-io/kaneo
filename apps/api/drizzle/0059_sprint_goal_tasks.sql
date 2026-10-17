CREATE TABLE "sprint_goal_task" (
	"goal_id" text NOT NULL,
	"task_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sprint_goal_task_goal_id_task_id_pk" PRIMARY KEY("goal_id","task_id")
);
--> statement-breakpoint
ALTER TABLE "sprint_goal" ADD COLUMN "repeat_weekly" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sprint_goal_task" ADD CONSTRAINT "sprint_goal_task_goal_id_sprint_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."sprint_goal"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sprint_goal_task" ADD CONSTRAINT "sprint_goal_task_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "sprint_goal_task_taskId_idx" ON "sprint_goal_task" USING btree ("task_id");