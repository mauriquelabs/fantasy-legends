ALTER TABLE "competitions" ADD COLUMN "season" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "fd_code" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "sorare_slug" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "display_name" text;--> statement-breakpoint

INSERT INTO "competitions" ("code", "name", "sport", "season", "starts_at", "ends_at", "fd_code", "sorare_slug", "status", "display_name")
VALUES (
  'WC',
  'FIFA World Cup',
  'football',
  '2026',
  '2026-06-11T00:00:00.000Z',
  '2026-07-19T23:59:59.000Z',
  'WC',
  'global-cup',
  'active',
  'World Cup 2026'
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "sport" = EXCLUDED."sport",
  "season" = EXCLUDED."season",
  "starts_at" = EXCLUDED."starts_at",
  "ends_at" = EXCLUDED."ends_at",
  "fd_code" = EXCLUDED."fd_code",
  "sorare_slug" = EXCLUDED."sorare_slug",
  "status" = EXCLUDED."status",
  "display_name" = EXCLUDED."display_name";--> statement-breakpoint

ALTER TABLE "leagues" ADD COLUMN "competition_id" integer;--> statement-breakpoint
UPDATE "leagues" SET "competition_id" = (SELECT "id" FROM "competitions" WHERE "code" = 'WC') WHERE "competition_id" IS NULL;--> statement-breakpoint
ALTER TABLE "leagues" ALTER COLUMN "competition_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;
