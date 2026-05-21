import { Router } from "express";
import { db, players, competitionTeams, positions } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import { fromCache, toCache } from "../lib/server-cache";

const router = Router();

const FD_BASE = "https://api.football-data.org/v4";
const SORARE_URL = "https://api.sorare.com/graphql";
const SORARE_AGENT = "Sorare Companion App";

const WC_COMPETITION_CODE = "WC";

// Name → Sorare slug for all WC 2026 national teams.
// Used during sync to record the FD team ID ↔ Sorare team slug mapping.
const WC_TEAMS: { name: string; slug: string }[] = [
  { name: "France", slug: "france" },
  { name: "Spain", slug: "spain" },
  { name: "England", slug: "england" },
  { name: "Germany", slug: "germany" },
  { name: "Portugal", slug: "portugal" },
  { name: "Netherlands", slug: "netherlands" },
  { name: "Italy", slug: "italy" },
  { name: "Belgium", slug: "belgium" },
  { name: "Croatia", slug: "croatia" },
  { name: "Switzerland", slug: "switzerland" },
  { name: "Austria", slug: "austria" },
  { name: "Denmark", slug: "denmark" },
  { name: "Poland", slug: "poland" },
  { name: "Turkey", slug: "turkey" },
  { name: "Serbia", slug: "serbia" },
  { name: "Scotland", slug: "scotland" },
  { name: "Argentina", slug: "argentina" },
  { name: "Brazil", slug: "brazil" },
  { name: "Colombia", slug: "colombia" },
  { name: "Uruguay", slug: "uruguay" },
  { name: "Ecuador", slug: "ecuador" },
  { name: "Paraguay", slug: "paraguay" },
  { name: "Venezuela", slug: "venezuela" },
  { name: "United States", slug: "united-states" },
  { name: "Mexico", slug: "mexico" },
  { name: "Canada", slug: "canada" },
  { name: "Panama", slug: "panama" },
  { name: "Honduras", slug: "honduras" },
  { name: "Costa Rica", slug: "costa-rica" },
  { name: "Jamaica", slug: "jamaica" },
  { name: "Morocco", slug: "morocco" },
  { name: "Senegal", slug: "senegal" },
  { name: "Nigeria", slug: "nigeria" },
  { name: "Egypt", slug: "egypt" },
  { name: "Ivory Coast", slug: "ivory-coast" },
  { name: "Cameroon", slug: "cameroon" },
  { name: "Mali", slug: "mali" },
  { name: "South Africa", slug: "south-africa" },
  { name: "Tunisia", slug: "tunisia" },
  { name: "Japan", slug: "japan" },
  { name: "South Korea", slug: "south-korea" },
  { name: "Iran", slug: "iran" },
  { name: "Australia", slug: "australia" },
  { name: "Saudi Arabia", slug: "saudi-arabia" },
  { name: "Iraq", slug: "iraq" },
  { name: "Jordan", slug: "jordan" },
  { name: "Uzbekistan", slug: "uzbekistan" },
  { name: "New Zealand", slug: "new-zealand" },
];


const TTL_TEAMS = 24 * 60 * 60 * 1000;
const TTL_SQUAD = 60 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fdHeaders(): Record<string, string> {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) throw new Error("FOOTBALL_DATA_API_KEY env var not set");
  return { "X-Auth-Token": key };
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

function namesOverlap(a: string, b: string): boolean {
  const aParts = normName(a).split(/\s+/);
  const bParts = normName(b).split(/\s+/);
  return aParts.some(w => w.length > 2 && bParts.includes(w));
}

function findSorareTeamSlug(fdTeamName: string): string | null {
  const norm = normName(fdTeamName);
  const exact = WC_TEAMS.find(t => normName(t.name) === norm);
  if (exact) return exact.slug;
  const fuzzy = WC_TEAMS.find(t => namesOverlap(t.name, fdTeamName));
  return fuzzy?.slug ?? null;
}

// ── Sorare ────────────────────────────────────────────────────────────────────

interface SorarePlayer {
  slug: string;
  displayName: string;
  position: string;
  avgScore: number | null;
  recentScores: number[];
  currentClub: string | null;
}

const PLAYER_FIELDS = `
  player {
    slug
    displayName
    position
    averageScore(type: LAST_FIFTEEN_SO5_AVERAGE_SCORE)
    so5Scores(last: 5) { score }
    activeClub { name }
  }
`;

function extractSorarePlayers(nodes: any[]): SorarePlayer[] {
  const seen = new Set<string>();
  const out: SorarePlayer[] = [];
  for (const node of nodes) {
    const p = node?.player;
    if (!p || seen.has(p.slug)) continue;
    seen.add(p.slug);
    out.push({
      slug: p.slug,
      displayName: p.displayName,
      position: p.position ?? "",
      avgScore: p.averageScore ?? null,
      recentScores: (p.so5Scores ?? []).map((s: any) => s.score as number),
      currentClub: p.activeClub?.name ?? null,
    });
  }
  return out;
}

// Minimal extractor for sync — only slug + displayName, no stats fields
function extractSyncPlayers(nodes: any[]): Pick<SorarePlayer, "slug" | "displayName">[] {
  const seen = new Set<string>();
  const out: Pick<SorarePlayer, "slug" | "displayName">[] = [];
  for (const node of nodes) {
    const p = node?.player;
    if (!p || seen.has(p.slug)) continue;
    seen.add(p.slug);
    out.push({ slug: p.slug, displayName: p.displayName });
  }
  return out;
}

// Paginate through all cards for a national team (up to 600 cards = ~200 unique players).
// Uses a minimal query (slug + displayName only) to stay well under the 500 complexity limit.
async function fetchTeamPlayersFull(sorareSlug: string): Promise<Pick<SorarePlayer, "slug" | "displayName">[]> {
  const all: Pick<SorarePlayer, "slug" | "displayName">[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < 20; page++) {
    const query = `
      query SyncTeamCards($slug: String!, $cursor: String) {
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
      body: JSON.stringify({ query, variables: { slug: sorareSlug, cursor } }),
    });
    const json: any = await res.json();
    if (json.error || json.errors) {
      console.warn(`Sorare error for ${sorareSlug} page ${page}:`, json.error ?? json.errors);
      break;
    }
    const cards = json?.data?.football?.allCards;
    if (!cards) break;

    for (const p of extractSyncPlayers(cards.nodes ?? [])) {
      if (!seen.has(p.slug)) { seen.add(p.slug); all.push(p); }
    }

    if (!cards.pageInfo?.hasNextPage) break;
    cursor = cards.pageInfo.endCursor;

    // Small pause between pages to stay within Sorare rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  return all;
}

// Fetch live stats for a set of known Sorare slugs using direct player(slug:) lookups.
// Unlike allCards(playerSlugs:), this guarantees a result for every slug regardless
// of whether the player has cards currently listed.
async function fetchLiveStats(sorareSlugs: string[]): Promise<Map<string, SorarePlayer>> {
  const result = new Map<string, SorarePlayer>();
  if (!sorareSlugs.length) return result;

  const playerFields = `
    slug
    displayName
    position
    averageScore(type: LAST_FIFTEEN_SO5_AVERAGE_SCORE)
    so5Scores(last: 5) { score }
    activeClub { name }
  `;

  const BATCH = 20;
  for (let i = 0; i < sorareSlugs.length; i += BATCH) {
    const batch = sorareSlugs.slice(i, i + BATCH);

    const aliases = batch
      .map((slug, j) => `p${j}: player(slug: ${JSON.stringify(slug)}) { ${playerFields} }`)
      .join("\n");

    const query = `query LiveStats { football { ${aliases} } }`;

    const res = await fetch(SORARE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
      body: JSON.stringify({ query }),
    });
    const json: any = await res.json();
    const football = json?.data?.football;
    if (!football) continue;

    for (let j = 0; j < batch.length; j++) {
      const p = football[`p${j}`];
      if (!p?.slug) continue;
      result.set(p.slug, {
        slug: p.slug,
        displayName: p.displayName,
        position: p.position ?? "",
        avgScore: p.averageScore ?? null,
        recentScores: (p.so5Scores ?? []).map((s: any) => s.score as number),
        currentClub: p.activeClub?.name ?? null,
      });
    }
  }

  return result;
}

function matchPlayer(
  fdName: string,
  sorarePool: Pick<SorarePlayer, "slug" | "displayName">[],
  usedSlugs: Set<string>,
): { slug: string; displayName: string; confidence: "exact" | "fuzzy" } | null {
  const norm = normName(fdName);
  const exact = sorarePool.find(sp => !usedSlugs.has(sp.slug) && normName(sp.displayName) === norm);
  if (exact) return { ...exact, confidence: "exact" };
  const fuzzy = sorarePool.find(sp => !usedSlugs.has(sp.slug) && namesOverlap(sp.displayName, fdName));
  if (fuzzy) return { ...fuzzy, confidence: "fuzzy" };
  return null;
}

// ── Position normalisation ────────────────────────────────────────────────────

async function getPositionMap(sport: string): Promise<Map<string, string>> {
  const rows = await db.select().from(positions).where(eq(positions.sport, sport));
  return new Map(rows.map(r => [r.rawName, r.canonicalName]));
}

// ── Exported types ────────────────────────────────────────────────────────────

export interface SquadPlayer {
  id: number;
  name: string;
  position: string;
  dateOfBirth: string | null;
  nationality: string | null;
  shirtNumber: number | null;
  sorareSlug: string | null;
  sorare: SorarePlayer | null;
  matchConfidence: "exact" | "fuzzy" | "manual" | "unmatched" | null;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/world-cup/teams
router.get("/world-cup/teams", async (_req, res): Promise<void> => {
  const cached = fromCache<any>("wc-teams", TTL_TEAMS);
  if (cached) { res.json(cached); return; }

  let headers: Record<string, string>;
  try { headers = fdHeaders(); } catch (e) {
    res.status(500).json({ error: String(e) }); return;
  }

  const r = await fetch(`${FD_BASE}/competitions/WC/teams`, { headers });
  if (!r.ok) { res.status(r.status).json({ error: `football-data.org: ${r.status}` }); return; }

  const data: any = await r.json();
  const result = {
    season: data.season?.startDate?.slice(0, 4) ?? null,
    teams: (data.teams ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      tla: t.tla,
      crest: t.crest,
      area: t.area?.name ?? null,
    })),
  };

  toCache("wc-teams", result);
  res.json(result);
});

// POST /api/world-cup/sync
// Seeds/refreshes the players table for all WC teams.
// Safe to re-run: upserts on fd_player_id, preserves manual overrides.
router.post("/world-cup/sync", async (_req, res): Promise<void> => {
  let headers: Record<string, string>;
  try { headers = fdHeaders(); } catch (e) {
    res.status(500).json({ error: String(e) }); return;
  }

  const teamsRes = await fetch(`${FD_BASE}/competitions/WC/teams`, { headers });
  if (!teamsRes.ok) { res.status(teamsRes.status).json({ error: `FD teams: ${teamsRes.status}` }); return; }
  const teamsData: any = await teamsRes.json();
  const season = String(teamsData.season?.startDate?.slice(0, 4) ?? new Date().getFullYear());
  const fdTeams: any[] = teamsData.teams ?? [];

  const stats = { teams: 0, players: 0, exact: 0, fuzzy: 0, unmatched: 0 };

  for (const fdTeam of fdTeams) {
    const sorareTeamSlug = findSorareTeamSlug(fdTeam.name ?? "");
    if (!sorareTeamSlug) continue;

    // Record the FD team ↔ Sorare team slug mapping
    await db.insert(competitionTeams).values({
      competitionCode: WC_COMPETITION_CODE,
      season,
      fdTeamId: fdTeam.id,
      fdTeamName: fdTeam.name,
      sorareTeamSlug,
    }).onConflictDoUpdate({
      target: [competitionTeams.competitionCode, competitionTeams.season, competitionTeams.fdTeamId],
      set: {
        fdTeamName: sql`excluded.fd_team_name`,
        sorareTeamSlug: sql`excluded.sorare_team_slug`,
      },
    });

    // Fetch FD squad
    const squadRes = await fetch(`${FD_BASE}/teams/${fdTeam.id}`, { headers });
    if (!squadRes.ok) continue;
    const fdTeamData: any = await squadRes.json();
    const squad: any[] = fdTeamData.squad ?? [];
    if (!squad.length) continue;

    // Fetch all Sorare players for this national team (paginated)
    const sorarePool = await fetchTeamPlayersFull(sorareTeamSlug);
    const usedSlugs = new Set<string>();

    for (const fdPlayer of squad) {
      const match = matchPlayer(fdPlayer.name, sorarePool, usedSlugs);
      if (match) usedSlugs.add(match.slug);

      await db.insert(players).values({
        fdPlayerId: fdPlayer.id,
        sorareSlug: match?.slug ?? null,
        name: fdPlayer.name,
        dateOfBirth: fdPlayer.dateOfBirth ?? null,
        nationality: fdPlayer.nationality ?? null,
        position: fdPlayer.position ?? null,
        matchConfidence: match ? match.confidence : "unmatched",
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: players.fdPlayerId,
        set: {
          // Never overwrite a manual match
          sorareSlug: sql`CASE WHEN players.match_confidence = 'manual' THEN players.sorare_slug ELSE excluded.sorare_slug END`,
          name: sql`excluded.name`,
          dateOfBirth: sql`excluded.date_of_birth`,
          nationality: sql`excluded.nationality`,
          position: sql`excluded.position`,
          matchConfidence: sql`CASE WHEN players.match_confidence = 'manual' THEN 'manual' ELSE excluded.match_confidence END`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

      if (match?.confidence === "exact") stats.exact++;
      else if (match?.confidence === "fuzzy") stats.fuzzy++;
      else stats.unmatched++;
      stats.players++;
    }

    stats.teams++;

    // Pause between teams to respect Sorare's rate limit
    await new Promise(r => setTimeout(r, 1000));
  }

  res.json(stats);
});

// GET /api/world-cup/squad/:teamId
// Reads the FD→Sorare mapping from DB, then fetches live Sorare stats.
router.get("/world-cup/squad/:teamId", async (req, res): Promise<void> => {
  const teamId = Number(req.params.teamId);
  if (!Number.isFinite(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  const cacheKey = `squad:${teamId}`;
  const cached = fromCache<any>(cacheKey, TTL_SQUAD);
  if (cached) { res.json(cached); return; }

  let headers: Record<string, string>;
  try { headers = fdHeaders(); } catch (e) {
    res.status(500).json({ error: String(e) }); return;
  }

  // Fetch fresh squad from FD (authoritative for roster, positions, shirt numbers)
  const r = await fetch(`${FD_BASE}/teams/${teamId}`, { headers });
  if (!r.ok) { res.status(r.status).json({ error: `football-data.org: ${r.status}` }); return; }

  const fdTeam: any = await r.json();
  const rawSquad: any[] = fdTeam.squad ?? [];
  const fdIds = rawSquad.map((p: any) => p.id as number);

  // Look up the FD→Sorare mapping for each player from DB
  const dbRows = fdIds.length
    ? await db.select().from(players).where(inArray(players.fdPlayerId, fdIds))
    : [];

  const byFdId = new Map(dbRows.map(row => [row.fdPlayerId!, row]));

  // Fetch live Sorare stats for all players we have a slug for
  const knownSlugs = dbRows.map(r => r.sorareSlug).filter((s): s is string => s != null);
  const [liveStats, positionMap] = await Promise.all([
    fetchLiveStats(knownSlugs),
    getPositionMap("football"),
  ]);

  const squadPlayers: SquadPlayer[] = rawSquad.map((p: any) => {
    const row = byFdId.get(p.id);
    const slug = row?.sorareSlug ?? null;
    const live = slug ? liveStats.get(slug) ?? null : null;
    const rawPosition: string | null = p.position ?? null;
    const position = rawPosition != null
      ? (positionMap.get(rawPosition) ?? null)
      : null;
    return {
      id: p.id,
      name: p.name,
      position: position ?? "Unknown",
      dateOfBirth: p.dateOfBirth ?? null,
      nationality: p.nationality ?? null,
      shirtNumber: p.shirtNumber ?? null,
      sorareSlug: slug,
      sorare: live,
      matchConfidence: row?.matchConfidence ?? null,
    };
  });

  const result = {
    teamId: fdTeam.id,
    teamName: fdTeam.name,
    teamShortName: fdTeam.shortName,
    teamCrest: fdTeam.crest ?? null,
    players: squadPlayers,
  };

  toCache(cacheKey, result);
  res.json(result);
});

export default router;
