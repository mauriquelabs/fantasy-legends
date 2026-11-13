import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, competitions, leagues, leagueMembers } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

const DEFAULT_COMPETITION_CODE = "WC";

async function resolveCompetitionId(codeOrId?: string | number): Promise<number | null> {
  if (typeof codeOrId === "number" && Number.isFinite(codeOrId)) {
    const [byId] = await db
      .select({ id: competitions.id })
      .from(competitions)
      .where(eq(competitions.id, codeOrId))
      .limit(1);
    return byId?.id ?? null;
  }
  const code =
    typeof codeOrId === "string" && codeOrId.trim()
      ? codeOrId.trim()
      : DEFAULT_COMPETITION_CODE;
  const [row] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.code, code))
    .limit(1);
  return row?.id ?? null;
}

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
      competitionId: leagues.competitionId,
      competitionCode: competitions.code,
      competitionName: competitions.displayName,
      memberCount: sql<number>`(select count(*) from league_members where league_id = ${leagues.id})::int`,
    })
    .from(leagues)
    .innerJoin(leagueMembers, eq(leagueMembers.leagueId, leagues.id))
    .innerJoin(competitions, eq(competitions.id, leagues.competitionId))
    .where(eq(leagueMembers.userId, user.id))
    .orderBy(leagues.createdAt);

  return res.json(rows.map((r) => ({
    ...r,
    competitionName: r.competitionName ?? undefined,
  })));
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
      competitionId: leagues.competitionId,
      competitionCode: competitions.code,
      competitionName: competitions.displayName,
      memberCount: sql<number>`(select count(*) from league_members where league_id = ${leagues.id})::int`,
    })
    .from(leagues)
    .innerJoin(competitions, eq(competitions.id, leagues.competitionId))
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
    .values({ leagueId: league[0].id, userId: user.id })
    .onConflictDoNothing();

  return res.json({ joined: true });
});

// POST /api/leagues — authenticated, creates a new league
router.post("/leagues", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { name, code, draftAt, competitionCode, competitionId } = req.body as {
    name?: string;
    code?: string;
    draftAt?: string;
    competitionCode?: string;
    competitionId?: number;
  };

  if (!name || !code) return res.status(400).json({ error: "name and code are required" });
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(code)) {
    return res.status(400).json({ error: "code must be 3-20 alphanumeric characters" });
  }

  const resolvedCompetitionId = await resolveCompetitionId(
    competitionId ?? competitionCode ?? DEFAULT_COMPETITION_CODE,
  );
  if (!resolvedCompetitionId) {
    return res.status(400).json({ error: "Unknown competition" });
  }

  try {
    const [league] = await db
      .insert(leagues)
      .values({
        code,
        name,
        draftAt: draftAt ? new Date(draftAt) : null,
        competitionId: resolvedCompetitionId,
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
