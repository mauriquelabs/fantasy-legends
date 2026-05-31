CREATE TABLE IF NOT EXISTS "competition_teams" (
        "competition_code" text NOT NULL,
        "season" text NOT NULL,
        "team_id" integer NOT NULL,
        CONSTRAINT "competition_teams_competition_code_season_team_id_pk" PRIMARY KEY("competition_code","season","team_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competitions" (
        "code" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "sport" text DEFAULT 'football' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "players" (
        "id" serial PRIMARY KEY NOT NULL,
        "fd_player_id" integer,
        "sorare_slug" text,
        "name" text NOT NULL,
        "date_of_birth" text,
        "nationality" text,
        "position" text,
        "match_confidence" text,
        "hidden" boolean DEFAULT false NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "players_fd_player_id_unique" UNIQUE("fd_player_id"),
        CONSTRAINT "players_sorare_slug_unique" UNIQUE("sorare_slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "positions" (
        "id" serial PRIMARY KEY NOT NULL,
        "sport" text NOT NULL,
        "raw_name" text NOT NULL,
        "canonical_name" text NOT NULL,
        "sort_order" integer DEFAULT 99 NOT NULL,
        CONSTRAINT "positions_sport_raw_name_unique" UNIQUE("sport","raw_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_players" (
        "team_id" integer NOT NULL,
        "sorare_slug" text NOT NULL,
        "added_manually" boolean DEFAULT false NOT NULL,
        "excluded_from_sync" boolean DEFAULT false NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "team_players_team_id_sorare_slug_pk" PRIMARY KEY("team_id","sorare_slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teams" (
        "id" serial PRIMARY KEY NOT NULL,
        "fd_team_id" integer,
        "fd_team_name" text,
        "sorare_slug" text,
        "match_confidence" text,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "teams_fd_team_id_unique" UNIQUE("fd_team_id"),
        CONSTRAINT "teams_sorare_slug_unique" UNIQUE("sorare_slug")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_competition_code_competitions_code_fk" FOREIGN KEY ("competition_code") REFERENCES "public"."competitions"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "team_players" ADD CONSTRAINT "team_players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "hidden" boolean DEFAULT false NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
