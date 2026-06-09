-- Drop FK constraints on competition_code before altering competitions PK
ALTER TABLE "competition_teams" DROP CONSTRAINT "competition_teams_competition_code_competitions_code_fk";
--> statement-breakpoint
ALTER TABLE "games" DROP CONSTRAINT "games_competition_code_competitions_code_fk";
--> statement-breakpoint
-- Drop composite PK on competition_teams (includes competition_code)
ALTER TABLE "competition_teams" DROP CONSTRAINT "competition_teams_competition_code_season_team_id_pk";
--> statement-breakpoint
-- Add surrogate PK to competitions; demote code to unique natural key
ALTER TABLE "competitions" ADD COLUMN "id" serial;
--> statement-breakpoint
ALTER TABLE "competitions" DROP CONSTRAINT "competitions_pkey";
--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_pkey" PRIMARY KEY ("id");
--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_code_unique" UNIQUE ("code");
--> statement-breakpoint
-- Add integer FK columns to referencing tables
ALTER TABLE "competition_teams" ADD COLUMN "competition_id" integer;
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "competition_id" integer;
--> statement-breakpoint
-- Backfill from existing code values
UPDATE "competition_teams" ct SET "competition_id" = c.id FROM "competitions" c WHERE c.code = ct.competition_code;
--> statement-breakpoint
UPDATE "games" g SET "competition_id" = c.id FROM "competitions" c WHERE c.code = g.competition_code;
--> statement-breakpoint
-- Drop old text columns
ALTER TABLE "competition_teams" DROP COLUMN "competition_code";
--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "competition_code";
--> statement-breakpoint
-- Add FK constraints on the new integer columns
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Restore composite PK with competition_id
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_competition_id_season_team_id_pk" PRIMARY KEY ("competition_id", "season", "team_id");
--> statement-breakpoint
-- Enforce NOT NULL now that backfill is done
ALTER TABLE "competition_teams" ALTER COLUMN "competition_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "competition_id" SET NOT NULL;
