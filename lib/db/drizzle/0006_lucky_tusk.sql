-- Drop games if it exists but has no columns (broken state from a failed earlier push)
DO $$
DECLARE col_count integer;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'games';
  IF col_count = 0 THEN
    DROP TABLE IF EXISTS "games" CASCADE;
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "games" (
        "sorare_id" text PRIMARY KEY NOT NULL,
        "competition_code" text NOT NULL,
        "utc_date" timestamp with time zone NOT NULL,
        "home_team_slug" text,
        "away_team_slug" text,
        "home_team_name" text,
        "away_team_name" text,
        "home_team_crest" text,
        "away_team_crest" text
);
