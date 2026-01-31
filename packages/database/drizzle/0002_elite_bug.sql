 CREATE TABLE IF NOT EXISTS "league_invite" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"league_id" varchar,
	"role" varchar NOT NULL,
	"code" varchar(32) NOT NULL,
	"expires_at" timestamp,
	"created_by" varchar NOT NULL,
	"updated_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "league_invite" ADD CONSTRAINT "league_invite_league_id_league_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."league"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "league_invite_code_uq_idx" ON "league_invite" USING btree ("code");
