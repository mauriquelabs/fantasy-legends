import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, leagues, leagueMembers, picks } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { fetchFixture, fetchUpcomingFixtures } from "../lib/sorare-stats.js";

const router = Router();

// GET /api/gameweeks — returns upcoming/ongoing SO5 fixtures from Sorare
router.get("/gameweeks", async (_req, res) => {
  const fixtures = await fetchUpcomingFixtures();
  return res.json(fixtures.slice(0, 6));
});

// GET /api/leagues/:code/picks/:gameweekSlug — returns the authed user's picks for a gameweek
router.get("/leagues/:code/picks/:gameweekSlug", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  const league = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(eq(leagues.code, String(req.params.code)))
    .limit(1);

  if (!league.length) return res.status(404).json({ error: "League not found" });

  const existing = await db
    .select()
    .from(picks)
    .where(
      and(
        eq(picks.leagueId, league[0].id),
        eq(picks.userId, user.id),
        eq(picks.gameweekSlug, String(req.params.gameweekSlug)),
      )
    )
    .limit(1);

  return res.json(existing[0] ?? null);
});

// PUT /api/leagues/:code/picks/:gameweekSlug — submit or update picks
router.put("/leagues/:code/picks/:gameweekSlug", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { playerIds } = req.body as { playerIds?: unknown };

  const league = await db
    .select({ id: leagues.id, squadSize: leagues.squadSize })
    .from(leagues)
    .where(eq(leagues.code, String(req.params.code)))
    .limit(1);

  if (!league.length) return res.status(404).json({ error: "League not found" });
  const { id: leagueId, squadSize } = league[0];

  // Must be a member
  const membership = await db
    .select()
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, user.id)))
    .limit(1);

  if (!membership.length) return res.status(403).json({ error: "Not a member of this league" });

  // Validate playerIds
  if (!Array.isArray(playerIds) || playerIds.length !== squadSize) {
    return res.status(400).json({ error: `Exactly ${squadSize} player IDs required` });
  }
  if (!playerIds.every(id => Number.isInteger(id) && id > 0)) {
    return res.status(400).json({ error: "playerIds must be positive integers" });
  }

  // Enforce gameweek deadline
  const fixture = await fetchFixture(String(req.params.gameweekSlug));
  if (!fixture) return res.status(404).json({ error: "Gameweek not found" });
  if (new Date() >= new Date(fixture.startDate)) {
    return res.status(409).json({ error: "Gameweek has already started — picks are locked" });
  }

  await db
    .insert(picks)
    .values({ leagueId, userId: user.id, gameweekSlug: String(req.params.gameweekSlug), playerIds })
    .onConflictDoUpdate({
      target: [picks.leagueId, picks.userId, picks.gameweekSlug],
      set: { playerIds, submittedAt: new Date() },
    });

  return res.json({ saved: true, gameweekSlug: fixture.slug, playerIds });
});

export default router;
