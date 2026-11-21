-- Matches the users table of Supabase (no password_hash, id from the auth account).
-- Fresh databases only: never run against Supabase, which already has this shape.
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_hash";