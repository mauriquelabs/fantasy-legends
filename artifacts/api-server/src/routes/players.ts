import { Router } from "express";
import { db, players, teams, teamPlayers } from "@workspace/db";
import { and, eq, isNotNull, sql } from "drizzle-orm";
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
// Returns all non-hidden players from the DB, joined with their team name.
router.get("/players", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .selectDistinctOn([players.id], {
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
      .where(
        and(
          eq(players.hidden, false),
          eq(teamPlayers.excludedFromSync, false),
          isNotNull(players.sorareSlug),
          sql`${players.position} IS DISTINCT FROM 'Coach'`,
        )
      )
      .orderBy(players.id, players.name);

    res.json({ players: rows });
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
