ALTER TABLE "players" ADD COLUMN "avg_score" real;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "recent_scores" json;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "scores_updated_at" timestamp with time zone;
