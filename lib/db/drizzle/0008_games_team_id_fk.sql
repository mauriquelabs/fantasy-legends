ALTER TABLE "games" DROP CONSTRAINT "games_home_team_slug_teams_sorare_slug_fk";
--> statement-breakpoint
ALTER TABLE "games" DROP CONSTRAINT "games_away_team_slug_teams_sorare_slug_fk";
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "home_team_id" integer;
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "away_team_id" integer;
--> statement-breakpoint
UPDATE "games" g SET "home_team_id" = t.id FROM "teams" t WHERE t.sorare_slug = g.home_team_slug;
--> statement-breakpoint
UPDATE "games" g SET "away_team_id" = t.id FROM "teams" t WHERE t.sorare_slug = g.away_team_slug;
--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "home_team_slug";
--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "away_team_slug";
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
