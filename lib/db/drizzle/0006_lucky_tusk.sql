CREATE TABLE "games" (
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
