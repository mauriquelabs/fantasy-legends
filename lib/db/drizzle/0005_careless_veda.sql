CREATE TABLE "picks" (
	"league_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"gameweek_slug" text NOT NULL,
	"player_ids" json NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "picks_league_id_user_id_gameweek_slug_pk" PRIMARY KEY("league_id","user_id","gameweek_slug")
);
--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "squad_size" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;