CREATE TABLE IF NOT EXISTS "leagues" (
  "id" serial PRIMARY KEY,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "draft_at" timestamptz,
  "created_by" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "league_members" (
  "league_id" integer NOT NULL REFERENCES "leagues"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("league_id", "user_id")
);
