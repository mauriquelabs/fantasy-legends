ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "name" text;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "crest_url" text;
--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN IF EXISTS "home_team_name";
--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN IF EXISTS "away_team_name";
--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN IF EXISTS "home_team_crest";
--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN IF EXISTS "away_team_crest";
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'games_competition_code_competitions_code_fk' AND table_name = 'games'
  ) THEN
    ALTER TABLE "games" ADD CONSTRAINT "games_competition_code_competitions_code_fk" FOREIGN KEY ("competition_code") REFERENCES "public"."competitions"("code") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'games_home_team_slug_teams_sorare_slug_fk' AND table_name = 'games'
  ) THEN
    ALTER TABLE "games" ADD CONSTRAINT "games_home_team_slug_teams_sorare_slug_fk" FOREIGN KEY ("home_team_slug") REFERENCES "public"."teams"("sorare_slug") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'games_away_team_slug_teams_sorare_slug_fk' AND table_name = 'games'
  ) THEN
    ALTER TABLE "games" ADD CONSTRAINT "games_away_team_slug_teams_sorare_slug_fk" FOREIGN KEY ("away_team_slug") REFERENCES "public"."teams"("sorare_slug") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
