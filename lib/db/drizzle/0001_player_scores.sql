ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "avg_score" real;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "recent_scores" json;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "scores_updated_at" timestamp with time zone;
