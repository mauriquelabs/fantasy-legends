import { Router } from "express";
import { db, players, teams, competitions, competitionTeams, positions } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import { fromCache, toCache } from "../lib/server-cache";

const router = Router();

const FD_BASE = "https://api.football-data.org/v4";
const SORARE_URL = "https://api.sorare.com/graphql";
const SORARE_AGENT = "Sorare Companion App";

const WC_COMPETITION_CODE = "WC";

const TTL_TEAMS = 24 * 60 * 60 * 1000;
const TTL_SQUAD = 60 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fdHeaders(): Record<string, string> {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) throw new Error("FOOTBALL_DATA_API_KEY env var not set");
  return { "X-Auth-Token": key };
}

// Derives Sorare slug candidates from an FD player name.
// e.g. "Aurélien Tchouaméni" → ["aurelien-tchouameni", "tchouameni-aurelien"]
function slugVariants(fdName: string): string[] {
  const normalized = fdName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
  const parts = normalized.split(/\s+/).filter(Boolean);
  const variants = new Set<string>();
  variants.add(parts.join("-"));
  if (parts.length >= 2) {
    variants.add([...parts].reverse().join("-"));
    if (parts.length > 2) variants.add(`${parts[0]}-${parts[parts.length - 1]}`);
  }
  return [...variants];
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

// Checks which slug variants actually exist in Sorare using allCards(playerSlugs: [...]).
// Unlike player(slug:), allCards returns no nodes for unknown slugs instead of a hard error,
// so a single bad variant doesn't blow up the whole batch.
// Returns the set of variants that Sorare confirmed as real player slugs.
async function matchSlugVariants(variants: string[]): Promise<Set<string>> {
  const confirmed = new Set<string>();
  if (!variants.length) return confirmed;

  const BATCH = 30;
  for (let i = 0; i < variants.length; i += BATCH) {
    const batch = variants.slice(i, i + BATCH);
    const res = await fetch(SORARE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
      body: JSON.stringify({
        query: `query MatchSlugs($slugs: [String!]!) {
          football {
            allCards(first: 30, playerSlugs: $slugs, sorts: [POPULAR_FIRST]) {
              nodes { player { slug } }
            }
          }
        }`,
        variables: { slugs: batch },
      }),
    });
    const json: any = await res.json();
    for (const node of json?.data?.football?.allCards?.nodes ?? []) {
      const slug = node?.player?.slug;
      if (slug) confirmed.add(slug);
    }
    await new Promise(r => setTimeout(r, 200));
  }
  return confirmed;
}

// Fetches live stats for a set of known Sorare slugs via direct player(slug:) lookups.
// Only call this with slugs confirmed to exist — a single unknown slug causes a hard
// NOT_FOUND error from Sorare that silently kills the entire aliased batch.
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
  hidden: boolean;
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
// Seeds/refreshes players for all WC teams using per-player slug-variant lookup.
// Matches each FD player name to a Sorare player directly — no national team card pool needed.
// Safe to re-run: upserts on fd_player_id / fd_team_id, preserves manual overrides.
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

  await db.insert(competitions).values({
    code: WC_COMPETITION_CODE,
    name: "FIFA World Cup",
    sport: "football",
  }).onConflictDoNothing();

  for (const fdTeam of fdTeams) {
    // Upsert team — sorareSlug left null until set manually or via future team-linking flow
    const [team] = await db.insert(teams).values({
      fdTeamId: fdTeam.id,
      fdTeamName: fdTeam.name,
      sorareSlug: null,
      matchConfidence: "unmatched",
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: teams.fdTeamId,
      set: {
        fdTeamName: sql`excluded.fd_team_name`,
        updatedAt: sql`excluded.updated_at`,
        // Never overwrite a manual team-slug link
        sorareSlug: sql`CASE WHEN teams.match_confidence = 'manual' THEN teams.sorare_slug ELSE excluded.sorare_slug END`,
      },
    }).returning({ id: teams.id });

    await db.insert(competitionTeams).values({
      competitionCode: WC_COMPETITION_CODE,
      season,
      teamId: team.id,
    }).onConflictDoNothing();

    const squadRes = await fetch(`${FD_BASE}/teams/${fdTeam.id}`, { headers });
    if (!squadRes.ok) continue;
    const fdTeamData: any = await squadRes.json();
    const squad: any[] = fdTeamData.squad ?? [];
    if (!squad.length) continue;

    // Collect all slug variants for the squad and confirm which ones exist in Sorare.
    // allCards handles unknown slugs gracefully — no hard errors, just empty nodes.
    const allVariants = squad.flatMap(p => slugVariants(p.name));
    const confirmedSlugs = await matchSlugVariants(allVariants);

    for (const fdPlayer of squad) {
      const variants = slugVariants(fdPlayer.name);

      // First variant is canonical (first-last), rest are alternatives
      let sorareSlug: string | null = null;
      let confidence: "exact" | "fuzzy" = "exact";
      for (let i = 0; i < variants.length; i++) {
        if (confirmedSlugs.has(variants[i])) {
          sorareSlug = variants[i];
          confidence = i === 0 ? "exact" : "fuzzy";
          break;
        }
      }

      await db.insert(players).values({
        fdPlayerId: fdPlayer.id,
        sorareSlug,
        name: fdPlayer.name,
        dateOfBirth: fdPlayer.dateOfBirth ?? null,
        nationality: fdPlayer.nationality ?? null,
        position: fdPlayer.position ?? null,
        matchConfidence: sorareSlug ? confidence : "unmatched",
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: players.fdPlayerId,
        set: {
          // Never overwrite a manual player-slug link
          sorareSlug: sql`CASE WHEN players.match_confidence = 'manual' THEN players.sorare_slug ELSE excluded.sorare_slug END`,
          name: sql`excluded.name`,
          dateOfBirth: sql`excluded.date_of_birth`,
          nationality: sql`excluded.nationality`,
          position: sql`excluded.position`,
          matchConfidence: sql`CASE WHEN players.match_confidence = 'manual' THEN 'manual' ELSE excluded.match_confidence END`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

      if (sorareSlug) {
        if (confidence === "exact") stats.exact++;
        else stats.fuzzy++;
      } else {
        stats.unmatched++;
      }
      stats.players++;
    }

    stats.teams++;
    // FD free tier: 10 requests/minute. Each team costs 1 request for the squad fetch.
    await new Promise(r => setTimeout(r, 6500));
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

  const r = await fetch(`${FD_BASE}/teams/${teamId}`, { headers });
  if (!r.ok) { res.status(r.status).json({ error: `football-data.org: ${r.status}` }); return; }

  const fdTeam: any = await r.json();
  const rawSquad: any[] = fdTeam.squad ?? [];
  const fdIds = rawSquad.map((p: any) => p.id as number);

  const dbRows = fdIds.length
    ? await db.select().from(players).where(inArray(players.fdPlayerId, fdIds))
    : [];

  const byFdId = new Map(dbRows.map(row => [row.fdPlayerId!, row]));

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
    const position = rawPosition != null ? (positionMap.get(rawPosition) ?? null) : null;
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
      hidden: row?.hidden ?? false,
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
