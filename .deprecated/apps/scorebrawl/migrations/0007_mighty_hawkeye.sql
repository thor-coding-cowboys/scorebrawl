ALTER TABLE "user" RENAME COLUMN "defaultLeagueId" TO "default_league_id";--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user" ADD CONSTRAINT "user_default_league_id_league_id_fk" FOREIGN KEY ("default_league_id") REFERENCES "public"."league"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
