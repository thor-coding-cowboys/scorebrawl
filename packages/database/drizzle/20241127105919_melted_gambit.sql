ALTER TABLE "session" ADD COLUMN "token" text;--> statement-breakpoint
ALTER TABLE "verification" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "verification" ADD COLUMN "created_at" timestamp;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";--> statement-breakpoint
UPDATE SESSION SET token = uuid_generate_v4();--> statement-breakpoint