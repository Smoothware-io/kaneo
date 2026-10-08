ALTER TABLE "task" ADD COLUMN "blocked_reason" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "blocked_on_user_id" text;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_blocked_on_user_id_user_id_fk" FOREIGN KEY ("blocked_on_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_blockedOnUserId_idx" ON "task" USING btree ("blocked_on_user_id");--> statement-breakpoint
-- Give existing workflows a Blocked column right after In Progress (or at the
-- end when that column was removed). Projects without any columns are left to
-- the startup column seeding, and a project that already has a "blocked" slug
-- keeps its own column.
WITH targets AS (
  SELECT
    p."id" AS project_id,
    COALESCE(
      (SELECT c."position" + 1 FROM "column" c
        WHERE c."project_id" = p."id" AND c."slug" = 'in-progress'
        ORDER BY c."position" LIMIT 1),
      (SELECT MAX(c."position") + 1 FROM "column" c
        WHERE c."project_id" = p."id")
    ) AS position
  FROM "project" p
  WHERE EXISTS (SELECT 1 FROM "column" c WHERE c."project_id" = p."id")
    AND NOT EXISTS (
      SELECT 1 FROM "column" c
      WHERE c."project_id" = p."id" AND c."slug" = 'blocked'
    )
), shifted AS (
  UPDATE "column" c
  SET "position" = c."position" + 1
  FROM targets t
  WHERE c."project_id" = t.project_id AND c."position" >= t.position
)
INSERT INTO "column" ("id", "project_id", "name", "slug", "position", "is_final", "created_at", "updated_at")
SELECT gen_random_uuid()::text, project_id, 'Blocked', 'blocked', position, false, now(), now()
FROM targets;
