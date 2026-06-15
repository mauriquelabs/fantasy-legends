-- Enable RLS on all public tables and add access policies.
-- The API server connects as the postgres/service role and bypasses RLS automatically.
-- These policies guard against direct anon/authenticated client access.

-- Internal Drizzle migration tracking table: no public access
ALTER TABLE "_migrations" ENABLE ROW LEVEL SECURITY;

-- Unknown tables not managed by Drizzle: lock down until schema is established
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;

-- Reference / lookup tables: any authenticated user may read, only service role may write
ALTER TABLE "positions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions_select" ON "positions" FOR SELECT TO authenticated USING (true);

ALTER TABLE "players" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players_select" ON "players" FOR SELECT TO authenticated USING (true);

ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_select" ON "teams" FOR SELECT TO authenticated USING (true);

ALTER TABLE "team_players" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_players_select" ON "team_players" FOR SELECT TO authenticated USING (true);

ALTER TABLE "competitions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competitions_select" ON "competitions" FOR SELECT TO authenticated USING (true);

ALTER TABLE "competition_teams" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competition_teams_select" ON "competition_teams" FOR SELECT TO authenticated USING (true);

ALTER TABLE "games" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games_select" ON "games" FOR SELECT TO authenticated USING (true);

ALTER TABLE "so5_fixtures" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "so5_fixtures_select" ON "so5_fixtures" FOR SELECT TO authenticated USING (true);

-- League tables: scoped to members only
ALTER TABLE "leagues" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leagues_member_select" ON "leagues" FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "league_members"
      WHERE "league_members"."league_id" = "leagues"."id"
        AND "league_members"."user_id" = auth.uid()::text
    )
  );

ALTER TABLE "league_members" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "league_members_same_league_select" ON "league_members" FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "league_members" AS lm
      WHERE lm."league_id" = "league_members"."league_id"
        AND lm."user_id" = auth.uid()::text
    )
  );

ALTER TABLE "picks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "picks_member_select" ON "picks" FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "league_members"
      WHERE "league_members"."league_id" = "picks"."league_id"
        AND "league_members"."user_id" = auth.uid()::text
    )
  );
