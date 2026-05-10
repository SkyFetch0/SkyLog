CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;--> statement-breakpoint
-- Bootstrap: promote the first registered user to admin (if any exist).
-- This runs exactly once per DB; new installations have no users yet so it's a no-op.
UPDATE "users" SET "role" = 'admin'
  WHERE "id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1);
