import { Router } from "express";
import { db, players } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { clearByPrefix } from "../lib/server-cache";

const router = Router();

const SORARE_URL = "https://api.sorare.com/graphql";
const SORARE_AGENT = "Sorare Companion App";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

// Score how well two names match (0 = no overlap, 1 = exact)
function similarity(fdName: string, sorareName: string): number {
  const a = normName(fdName);
  const b = normName(sorareName);
  if (a === b) return 1.0;
  const aParts = a.split(/\s+/).filter(w => w.length > 1);
  const bParts = b.split(/\s+/).filter(w => w.length > 1);
  if (!aParts.length || !bParts.length) return 0;
  const shared = aParts.filter(w => bParts.includes(w)).length;
  return shared / Math.max(aParts.length, bParts.length);
}

// ── Sorare candidate lookup ───────────────────────────────────────────────────

interface PoolEntry { slug: string; displayName: string }

// Broad card search — tries allCards(search: ...) which may or may not be supported
// by Sorare's public API; returns empty array on any error.
async function fetchByCardSearch(query: string): Promise<PoolEntry[]> {
  const gql = `
    query CardSearch($query: String!) {
      football {
        allCards(first: 20, search: $query, sorts: [POPULAR_FIRST]) {
          nodes { player { slug displayName } }
        }
      }
    }
  `;
  try {
    const res = await fetch(SORARE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
      body: JSON.stringify({ query: gql, variables: { query } }),
    });
    const json: any = await res.json();
    if (json.error || json.errors) return [];
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

// Direct player lookup by exact slug — queries the player database, not card listings.
// Works for players who have no currently listed cards.
async function fetchPlayerBySlug(slug: string): Promise<PoolEntry | null> {
  const query = `
    query PlayerLookup($slug: String!) {
      football {
        player(slug: $slug) { slug displayName }
      }
    }
  `;
  try {
    const res = await fetch(SORARE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
      body: JSON.stringify({ query, variables: { slug } }),
    });
    const json: any = await res.json();
    const p = json?.data?.football?.player;
    if (!p?.slug) return null;
    return { slug: p.slug, displayName: p.displayName };
  } catch {
    return null;
  }
}

// Build slug variants from a display name.
// e.g. "Aurélien Tchouameni" → ["aurelien-tchouameni", "tchouameni-aurelien"]
function slugVariants(fdName: string): string[] {
  const parts = normName(fdName).split(/\s+/).filter(Boolean);
  const variants = new Set<string>();
  variants.add(parts.join("-"));
  if (parts.length >= 2) {
    variants.add([...parts].reverse().join("-"));
    // first + last only (drops middle names)
    if (parts.length > 2) variants.add(`${parts[0]}-${parts[parts.length - 1]}`);
  }
  return [...variants];
}

// Query Sorare for specific player slugs — targeted, avoids popular-player dominance.
async function fetchByPlayerSlugs(slugs: string[]): Promise<PoolEntry[]> {
  if (!slugs.length) return [];
  const query = `
    query PlayerCandidates($slugs: [String!]!) {
      football {
        allCards(first: 20, playerSlugs: $slugs, sorts: [POPULAR_FIRST]) {
          nodes { player { slug displayName } }
        }
      }
    }
  `;
  const res = await fetch(SORARE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
    body: JSON.stringify({ query, variables: { slugs } }),
  });
  const json: any = await res.json();
  if (json.error || json.errors) return [];

  const seen = new Set<string>();
  const out: PoolEntry[] = [];
  for (const node of json?.data?.football?.allCards?.nodes ?? []) {
    const p = node?.player;
    if (!p || seen.has(p.slug)) continue;
    seen.add(p.slug);
    out.push({ slug: p.slug, displayName: p.displayName });
  }
  return out;
}

// Team pool cache — used as a fallback for players with legal-name slug suffixes
// (e.g. "kylian-mbappe-lottin") that can't be guessed from the display name alone.
const poolCache = new Map<string, { entries: PoolEntry[]; ts: number }>();
const POOL_TTL = 30 * 60 * 1000;

async function fetchSorareTeamPool(sorareTeamSlug: string): Promise<PoolEntry[]> {
  const hit = poolCache.get(sorareTeamSlug);
  if (hit && Date.now() - hit.ts < POOL_TTL) return hit.entries;

  // Paginate up to 10 pages of 30 cards — with deduplication we get up to ~60-80
  // unique players even for popular teams like France.
  const seen = new Set<string>();
  const entries: PoolEntry[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 10; page++) {
    const query = `
      query TeamPool($slug: String!, $cursor: String) {
        football {
          allCards(first: 30, teamSlugs: [$slug], sorts: [POPULAR_FIRST], after: $cursor) {
            nodes { player { slug displayName } }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    `;
    const res = await fetch(SORARE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
      body: JSON.stringify({ query, variables: { slug: sorareTeamSlug, cursor } }),
    });
    const json: any = await res.json();
    if (json.error || json.errors) break;

    const cards = json?.data?.football?.allCards;
    if (!cards) break;
    for (const node of cards.nodes ?? []) {
      const p = node?.player;
      if (!p || seen.has(p.slug)) continue;
      seen.add(p.slug);
      entries.push({ slug: p.slug, displayName: p.displayName });
    }
    if (!cards.pageInfo?.hasNextPage) break;
    cursor = cards.pageInfo.endCursor;
    await new Promise(r => setTimeout(r, 300));
  }

  poolCache.set(sorareTeamSlug, { entries, ts: Date.now() });
  return entries;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/players/:fdPlayerId/sorare-candidates
// Returns Sorare player candidates ranked by name similarity.
router.get("/players/:fdPlayerId/sorare-candidates", async (req, res): Promise<void> => {
  const fdPlayerId = Number(req.params.fdPlayerId);
  if (!Number.isFinite(fdPlayerId)) { res.status(400).json({ error: "Invalid fdPlayerId" }); return; }

  const [player] = await db.select().from(players).where(eq(players.fdPlayerId, fdPlayerId));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  // Prefer the sorareTeamSlug passed from the client (it knows the competition context)
  const sorareTeamSlug = typeof req.query.sorareTeamSlug === "string"
    ? req.query.sorareTeamSlug
    : null;

  // Primary: query by slug variants derived from the FD name (targeted, fast)
  const variants = slugVariants(player.name);
  const bySlug = await fetchByPlayerSlugs(variants);

  // Fallback: team pool for players whose slug includes a legal name we can't guess
  const teamPool = sorareTeamSlug ? await fetchSorareTeamPool(sorareTeamSlug) : [];

  // Merge, deduplicate, score
  const seen = new Set<string>();
  const merged: PoolEntry[] = [];
  for (const p of [...bySlug, ...teamPool]) {
    if (!seen.has(p.slug)) { seen.add(p.slug); merged.push(p); }
  }

  const candidates = merged
    .map(p => ({ slug: p.slug, displayName: p.displayName, score: similarity(player.name, p.displayName) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  res.json({
    fdPlayer: { id: player.fdPlayerId, name: player.name },
    candidates,
  });
});

// GET /api/sorare/search?q=...
// Name-based Sorare player search. Tries multiple strategies in parallel:
//  1. Direct player(slug:) lookup — works for exact slugs, finds players with no listed cards
//  2. allCards(playerSlugs:) — finds players who have cards currently listed
//  3. allCards(search:) — broad search if Sorare supports the param (fails silently if not)
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
  const sources = [...directResults.filter((p): p is PoolEntry => p !== null), ...byCards, ...bySearch];
  for (const p of sources) {
    if (!seen.has(p.slug)) { seen.add(p.slug); merged.push(p); }
  }

  const results = merged
    .map(p => ({ slug: p.slug, displayName: p.displayName, score: similarity(q, p.displayName) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  res.json({ results });
});

// PATCH /api/players/:fdPlayerId
// Saves a manual Sorare slug mapping.
router.patch("/players/:fdPlayerId", async (req, res): Promise<void> => {
  const fdPlayerId = Number(req.params.fdPlayerId);
  if (!Number.isFinite(fdPlayerId)) { res.status(400).json({ error: "Invalid fdPlayerId" }); return; }

  const { sorareSlug, name } = req.body;
  if (typeof sorareSlug !== "string" || !sorareSlug.trim()) {
    res.status(400).json({ error: "sorareSlug is required" }); return;
  }

  const slug = sorareSlug.trim();
  const playerName = typeof name === "string" && name.trim() ? name.trim() : `fd-player-${fdPlayerId}`;

  // Release slug from any conflicting holder then upsert — must be atomic so a
  // concurrent PATCH can't interleave between the two steps and violate the unique constraint.
  await db.transaction(async (tx) => {
    await tx.update(players)
      .set({ sorareSlug: null, matchConfidence: "unmatched", updatedAt: new Date() })
      .where(and(eq(players.sorareSlug, slug), sql`fd_player_id != ${fdPlayerId}`));

    await tx.insert(players)
      .values({ fdPlayerId, sorareSlug: slug, name: playerName, matchConfidence: "manual", updatedAt: new Date() })
      .onConflictDoUpdate({
        target: players.fdPlayerId,
        set: { sorareSlug: slug, matchConfidence: "manual", updatedAt: new Date() },
      });
  });

  clearByPrefix("squad:");
  res.json({ ok: true });
});

// PATCH /api/players/:fdPlayerId/hidden
// Hides or unhides a player (e.g. FD duplicates). Creates a minimal row if needed.
router.patch("/players/:fdPlayerId/hidden", async (req, res): Promise<void> => {
  const fdPlayerId = Number(req.params.fdPlayerId);
  if (!Number.isFinite(fdPlayerId)) { res.status(400).json({ error: "Invalid fdPlayerId" }); return; }

  const { hidden, name } = req.body;
  if (typeof hidden !== "boolean") {
    res.status(400).json({ error: "hidden (boolean) is required" }); return;
  }

  await db.insert(players)
    .values({
      fdPlayerId,
      hidden,
      name: typeof name === "string" && name.trim() ? name.trim() : `fd-player-${fdPlayerId}`,
      matchConfidence: "unmatched",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: players.fdPlayerId,
      set: { hidden, updatedAt: new Date() },
    });

  clearByPrefix("squad:");
  res.json({ ok: true });
});

export default router;
