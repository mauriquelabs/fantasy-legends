import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, leagues, leagueMembers } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/leagues — authenticated, returns leagues the user belongs to
router.get("/leagues", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  const rows = await db
    .select({
      id: leagues.id,
      code: leagues.code,
      name: leagues.name,
      draftAt: leagues.draftAt,
      createdAt: leagues.createdAt,
      memberCount: sql<number>`(select count(*) from league_members where league_id = ${leagues.id})::int`,
    })
    .from(leagues)
    .innerJoin(leagueMembers, eq(leagueMembers.leagueId, leagues.id))
    .where(eq(leagueMembers.userId, user.id))
    .orderBy(leagues.createdAt);

  return res.json(rows);
});

// GET /api/leagues/:code — public, returns league info + member count
router.get("/leagues/:code", async (req, res) => {
  const league = await db
    .select({
      id: leagues.id,
      code: leagues.code,
      name: leagues.name,
      squadSize: leagues.squadSize,
      draftAt: leagues.draftAt,
      createdAt: leagues.createdAt,
      memberCount: sql<number>`(select count(*) from league_members where league_id = ${leagues.id})::int`,
    })
    .from(leagues)
    .where(eq(leagues.code, String(req.params.code)))
    .limit(1);

  if (!league.length) return res.status(404).json({ error: "League not found" });
  return res.json(league[0]);
});

// POST /api/leagues/:code/join — authenticated, idempotent upsert
router.post("/leagues/:code/join", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  const league = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(eq(leagues.code, String(req.params.code)))
    .limit(1);

  if (!league.length) return res.status(404).json({ error: "League not found" });

  await db
    .insert(leagueMembers)
    .values({ leagueId: league[0].id, userId: user.id, email: user.email })
    .onConflictDoUpdate({
      target: [leagueMembers.leagueId, leagueMembers.userId],
      set: { email: user.email },
    });

  return res.json({ joined: true });
});

// GET /api/leagues/:code/scoreboard — authenticated member, returns ranked member list
router.get("/leagues/:code/scoreboard", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  const league = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(eq(leagues.code, String(req.params.code)))
    .limit(1);

  if (!league.length) return res.status(404).json({ error: "League not found" });

  const membership = await db
    .select()
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, league[0].id), eq(leagueMembers.userId, user.id)))
    .limit(1);

  if (!membership.length) return res.status(403).json({ error: "Not a member of this league" });

  const rows = await db
    .select({
      userId: leagueMembers.userId,
      email: leagueMembers.email,
      joinedAt: leagueMembers.joinedAt,
    })
    .from(leagueMembers)
    .where(eq(leagueMembers.leagueId, league[0].id))
    .orderBy(leagueMembers.joinedAt);

  return res.json(rows);
});

// POST /api/leagues — authenticated, creates a new league
router.post("/leagues", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { name, code, draftAt } = req.body as { name?: string; code?: string; draftAt?: string };

  if (!name || !code) return res.status(400).json({ error: "name and code are required" });
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(code)) {
    return res.status(400).json({ error: "code must be 3-20 alphanumeric characters" });
  }

  try {
    const [league] = await db
      .insert(leagues)
      .values({
        code,
        name,
        draftAt: draftAt ? new Date(draftAt) : null,
        createdBy: user.id,
      })
      .returning();
    const origin = req.headers.origin ?? process.env.APP_URL ?? '';
    return res.status(201).json({ ...league, inviteUrl: `${origin}/join/${league.code}` });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      return res.status(409).json({ error: "League code already taken" });
    }
    throw err;
  }
});

// PATCH /api/leagues/:code — authenticated owner only, update draft time
router.patch("/leagues/:code", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { draftAt } = req.body as { draftAt?: string | null };

  const league = await db
    .select({ id: leagues.id, createdBy: leagues.createdBy })
    .from(leagues)
    .where(eq(leagues.code, String(req.params.code)))
    .limit(1);

  if (!league.length) return res.status(404).json({ error: "League not found" });
  if (league[0].createdBy !== user.id) return res.status(403).json({ error: "Forbidden" });

  const [updated] = await db
    .update(leagues)
    .set({ draftAt: draftAt ? new Date(draftAt) : null })
    .where(eq(leagues.code, String(req.params.code)))
    .returning();

  return res.json(updated);
});

export default router;
