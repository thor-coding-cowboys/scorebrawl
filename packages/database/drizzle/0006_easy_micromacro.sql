DROP INDEX IF EXISTS "league_code_uq_idx";--> statement-breakpoint
ALTER TABLE "league_invite" ALTER COLUMN "league_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "league" DROP COLUMN IF EXISTS "code";