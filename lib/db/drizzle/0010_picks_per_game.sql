-- Replace gameweek-scoped picks with per-game picks
DROP TABLE IF EXISTS "picks";
--> statement-breakpoint
CREATE TABLE "picks" (
  "league_id" integer NOT NULL,
  "user_id" text NOT NULL,
  "game_id" text NOT NULL,
  "player_ids" json NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "picks_pkey" PRIMARY KEY("league_id","user_id","game_id")
);
--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_game_id_games_sorare_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("sorare_id") ON DELETE cascade ON UPDATE no action;
