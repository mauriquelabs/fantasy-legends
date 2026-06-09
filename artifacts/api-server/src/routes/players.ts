import { Router } from "express";
import { db, games, players, teams, teamPlayers, competitionTeams, competitions } from "@workspace/db";
import { and, eq, ilike, inArray, isNotNull, sql } from "drizzle-orm";
import { normName, slugVariants, similarity } from "../lib/player-utils.js";
import { logger } from "../lib/logger";

const router = Router();

const SORARE_URL = "https://api.sorare.com/graphql";
const SORARE_AGENT = "Sorare Companion App";

// ── Sorare player search ──────────────────────────────────────────────────────

interface PoolEntry { slug: string; displayName: string }

async function fetchPlayerBySlug(slug: string): Promise<PoolEntry | null> {
  try {
    const res = await fetch(SORARE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
      body: JSON.stringify({
        query: `query P($slug: String!) { football { player(slug: $slug) { slug displayName } } }`,
        variables: { slug },
      }),
    });
    const json: any = await res.json();
    const p = json?.data?.football?.player;
    return p?.slug ? { slug: p.slug, displayName: p.displayName } : null;
  } catch {
    return null;
  }
}

async function fetchByPlayerSlugs(slugs: string[]): Promise<PoolEntry[]> {
  if (!slugs.length) return [];
  try {
    const res = await fetch(SORARE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
      body: JSON.stringify({
        query: `query C($slugs: [String!]!) { football { allCards(first: 20, playerSlugs: $slugs, sorts: [POPULAR_FIRST]) { nodes { player { slug displayName } } } } }`,
        variables: { slugs },
      }),
    });
    const json: any = await res.json();
    if (json.errors) return [];
    const seen = new Set<string>();
    const out: PoolEntry[] = [];
    for (const node of json?.data?.football?.allCards?.nodes ?? []) {
      const p = node?.player;
      if (!p || seen.has(p.slug)) continue;
      seen.add(p.slug);
      out.push({ slug: p.slug, displayName: p.displayName });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchByCardSearch(query: string): Promise<PoolEntry[]> {
  try {
    const res = await fetch(SORARE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
      body: JSON.stringify({
        query: `query S($q: String!) { football { allCards(first: 20, search: $q, sorts: [POPULAR_FIRST]) { nodes { player { slug displayName } } } } }`,
        variables: { q: query },
      }),
    });
    const json: any = await res.json();
    if (json.errors) return [];
    const seen = new Set<string>();
    const out: PoolEntry[] = [];
    for (const node of json?.data?.football?.allCards?.nodes ?? []) {
      const p = node?.player;
      if (!p || seen.has(p.slug)) continue;
      seen.add(p.slug);
      out.push({ slug: p.slug, displayName: p.displayName });
    }
    return out;
  } catch {
    return [];
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/players
// Without filters: returns active players only (≥4 non-zero scores in last 5 rounds).
// With ?q=name or ?team=slug: bypasses activity filter for targeted browsing/search.
router.get("/players", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const teamSlug = typeof req.query.team === "string" ? req.query.team.trim() : "";
  const gameId = typeof req.query.gameId === "string" ? req.query.gameId.trim() : "";
  const bypassActivityFilter = q || teamSlug || gameId;

  let gameTeamIds: number[] | null = null;
  if (gameId) {
    const game = await db
      .select({ homeTeamId: games.homeTeamId, awayTeamId: games.awayTeamId })
      .from(games)
      .where(eq(games.sorareId, gameId))
      .limit(1);
    if (!game.length) { res.status(404).json({ error: "Game not found" }); return; }
    gameTeamIds = [game[0].homeTeamId, game[0].awayTeamId].filter((id): id is number => id != null);
    if (!gameTeamIds.length) { res.json({ players: [] }); return; }
  }

  try {
    const rows = await db
      .selectDistinctOn([players.id], {
        id: players.id,
        sorareSlug: players.sorareSlug,
        name: players.name,
        position: players.position,
        nationality: players.nationality,
        teamName: teams.fdTeamName,
        teamSlug: teams.sorareSlug,
        avgScore: players.avgScore,
        avg5Score: players.avg5Score,
        avg40Score: players.avg40Score,
        recentScores: players.recentScores,
        gamesPlayedLast15: players.gamesPlayedLast15,
        currentClub: players.currentClub,
      })
      .from(players)
      .innerJoin(teamPlayers, eq(teamPlayers.sorareSlug, players.sorareSlug))
      .innerJoin(teams, eq(teams.id, teamPlayers.teamId))
      .innerJoin(competitionTeams, eq(competitionTeams.teamId, teams.id))
      .innerJoin(competitions, eq(competitions.id, competitionTeams.competitionId))
      .where(
        and(
          eq(players.hidden, false),
          eq(teamPlayers.excludedFromSync, false),
          isNotNull(players.sorareSlug),
          sql`${players.position} IS DISTINCT FROM 'Coach'`,
          eq(competitions.code, "WC"),
          q ? ilike(players.name, `%${q}%`) : undefined,
          teamSlug ? eq(teams.sorareSlug, teamSlug) : undefined,
          gameTeamIds ? inArray(teamPlayers.teamId, gameTeamIds) : undefined,
        )
      )
      .orderBy(players.id, players.name);

    const result = bypassActivityFilter ? rows : rows.filter(r => (r.recentScores?.filter((s: number) => s > 0).length ?? 0) >= 4);
    res.json({ players: result });
  } catch (err) {
    logger.error({ err }, "GET /api/players failed");
    res.status(500).json({ error: "Failed to fetch players" });
  }
});

// GET /api/sorare/search?q=...
// Name-based Sorare player search — used by the Add Player dialog.
router.get("/sorare/search", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) { res.json({ results: [] }); return; }

  const variants = slugVariants(q);

  const [directResults, byCards, bySearch] = await Promise.all([
    Promise.all(variants.map(fetchPlayerBySlug)),
    fetchByPlayerSlugs(variants),
    fetchByCardSearch(q),
  ]);

  const seen = new Set<string>();
  const merged: PoolEntry[] = [];
  for (const p of [...directResults.filter((p): p is PoolEntry => p !== null), ...byCards, ...bySearch]) {
    if (!seen.has(p.slug)) { seen.add(p.slug); merged.push(p); }
  }

  const results = merged
    .map(p => ({ slug: p.slug, displayName: p.displayName, score: similarity(q, p.displayName) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  res.json({ results });
});

export default router;
