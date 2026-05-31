import { Router } from "express";
import { db, players, teams, competitions, competitionTeams, teamPlayers } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { fromCache, toCache, clearByPrefix } from "../lib/server-cache";

const router = Router();

const SORARE_URL = "https://api.sorare.com/graphql";
const SORARE_AGENT = "Sorare Companion App";
const WC_COMPETITION_CODE = "WC";
const WC_SEASON = "2026";
const TTL_SQUAD = 60 * 60 * 1000;

// All 48 WC 2026 teams with their verified Sorare slugs
const WC_TEAMS = [
  { slug: "france", name: "France" },
  { slug: "spain", name: "Spain" },
  { slug: "england", name: "England" },
  { slug: "germany", name: "Germany" },
  { slug: "portugal", name: "Portugal" },
  { slug: "netherlands", name: "Netherlands" },
  { slug: "italy", name: "Italy" },
  { slug: "belgium", name: "Belgium" },
  { slug: "croatia", name: "Croatia" },
  { slug: "switzerland", name: "Switzerland" },
  { slug: "austria", name: "Austria" },
  { slug: "denmark", name: "Denmark" },
  { slug: "poland", name: "Poland" },
  { slug: "turkey", name: "Turkey" },
  { slug: "serbia", name: "Serbia" },
  { slug: "scotland", name: "Scotland" },
  { slug: "argentina", name: "Argentina" },
  { slug: "brazil", name: "Brazil" },
  { slug: "colombia", name: "Colombia" },
  { slug: "uruguay", name: "Uruguay" },
  { slug: "ecuador", name: "Ecuador" },
  { slug: "paraguay", name: "Paraguay" },
  { slug: "venezuela", name: "Venezuela" },
  { slug: "united-states", name: "United States" },
  { slug: "mexico", name: "Mexico" },
  { slug: "canada", name: "Canada" },
  { slug: "panama", name: "Panama" },
  { slug: "honduras", name: "Honduras" },
  { slug: "costa-rica", name: "Costa Rica" },
  { slug: "jamaica", name: "Jamaica" },
  { slug: "morocco", name: "Morocco" },
  { slug: "senegal", name: "Senegal" },
  { slug: "nigeria", name: "Nigeria" },
  { slug: "egypt", name: "Egypt" },
  { slug: "cote-d-ivoire", name: "Côte d'Ivoire" },
  { slug: "cameroon", name: "Cameroon" },
  { slug: "mali", name: "Mali" },
  { slug: "south-africa", name: "South Africa" },
  { slug: "tunisia", name: "Tunisia" },
  { slug: "japan", name: "Japan" },
  { slug: "korea-republic", name: "South Korea" },
  { slug: "iran", name: "Iran" },
  { slug: "australia", name: "Australia" },
  { slug: "saudi-arabia", name: "Saudi Arabia" },
  { slug: "iraq", name: "Iraq" },
  { slug: "jordan", name: "Jordan" },
  { slug: "uzbekistan", name: "Uzbekistan" },
  { slug: "new-zealand", name: "New Zealand" },
];

// Maps Sorare position values to canonical display names
const SORARE_POSITION: Record<string, string> = {
  Goalkeeper: "Goalkeeper",
  Defender: "Defence",
  Midfielder: "Midfield",
  Forward: "Offence",
};

// ── Sorare ────────────────────────────────────────────────────────────────────

interface SorarePlayer {
  slug: string;
  displayName: string;
  position: string;
  avgScore: number | null;
  recentScores: number[];
  currentClub: string | null;
}

interface ActivePlayer {
  slug: string;
  displayName: string;
  position: string | null;
}

async function fetchActivePlayers(teamSlug: string): Promise<ActivePlayer[]> {
  const all: ActivePlayer[] = [];
  let cursor: string | null = null;

  try {
    for (let page = 0; page < 10; page++) {
      const res = await fetch(SORARE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
        body: JSON.stringify({
          query: `query ActivePlayers($slug: String!, $cursor: String) {
            football {
              nationalTeam(slug: $slug) {
                activePlayers(first: 50, after: $cursor) {
                  nodes { slug displayName position }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
          }`,
          variables: { slug: teamSlug, cursor },
        }),
      });
      const json: any = await res.json();
      if (json.errors) {
        console.warn(`Sorare error fetching activePlayers for ${teamSlug}:`, json.errors);
        break;
      }
      const ap = json?.data?.football?.nationalTeam?.activePlayers;
      if (!ap) break;
      all.push(...(ap.nodes ?? []));
      if (!ap.pageInfo?.hasNextPage) break;
      cursor = ap.pageInfo.endCursor;
    }
  } catch (err) {
    console.warn(`fetchActivePlayers network error for ${teamSlug}:`, err);
  }

  return all;
}

async function fetchLiveStats(sorareSlugs: string[]): Promise<Map<string, SorarePlayer>> {
  const result = new Map<string, SorarePlayer>();
  if (!sorareSlugs.length) return result;

  const playerFields = `
    slug displayName position
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

    const res = await fetch(SORARE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
      body: JSON.stringify({ query: `query LiveStats { football { ${aliases} } }` }),
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

async function fetchPlayerBySlug(slug: string): Promise<{ slug: string; displayName: string; position: string } | null> {
  try {
    const res = await fetch(SORARE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
      body: JSON.stringify({
        query: `query P($slug: String!) { football { player(slug: $slug) { slug displayName position } } }`,
        variables: { slug },
      }),
    });
    const json: any = await res.json();
    const p = json?.data?.football?.player;
    return p?.slug ? p : null;
  } catch {
    return null;
  }
}

// ── Exported types ────────────────────────────────────────────────────────────

export interface SquadPlayer {
  sorareSlug: string;
  name: string;
  position: string;
  addedManually: boolean;
  sorare: SorarePlayer | null;
}

// ── Routes ────────────────────────────────────────────────────────────────────

const FD_BASE = "https://api.football-data.org/v4";
const TTL_FIXTURES = 5 * 60 * 1000;

// Maps football-data.org team names to Sorare slugs for cases where the names diverge
const FD_NAME_OVERRIDES: Record<string, string> = {
  "Korea Republic": "korea-republic",
  "Côte d'Ivoire": "cote-d-ivoire",
  "Ivory Coast": "cote-d-ivoire",
  "IR Iran": "iran",
  "USA": "united-states",
};

const wcTeamByName = new Map(WC_TEAMS.map(t => [t.name.toLowerCase(), t.slug]));

export function sorareSlugFromFdName(fdName: string): string | undefined {
  return FD_NAME_OVERRIDES[fdName] ?? wcTeamByName.get(fdName.toLowerCase());
}

const STAGE_LABELS: Record<string, string> = {
  ROUND_OF_32: "Round of 32",
  ROUND_OF_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  THIRD_PLACE: "Third Place",
  FINAL: "Final",
};

// GET /api/world-cup/fixtures
// Returns WC 2026 schedule from football-data.org, grouped by round/matchday.
router.get("/world-cup/fixtures", async (_req, res): Promise<void> => {
  const cacheKey = "wc:fixtures";
  const cached = fromCache<any>(cacheKey, TTL_FIXTURES);
  if (cached) { res.json(cached); return; }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) { res.status(500).json({ error: "FOOTBALL_DATA_API_KEY not set" }); return; }

  let fdRes: Response;
  try {
    fdRes = await fetch(`${FD_BASE}/competitions/WC/matches`, {
      headers: { "X-Auth-Token": apiKey },
    });
  } catch {
    res.status(502).json({ error: "football-data.org unreachable" });
    return;
  }
  if (!fdRes.ok) { res.status(502).json({ error: `football-data.org returned ${fdRes.status}` }); return; }

  const data: any = await fdRes.json();
  const matches: any[] = data.matches ?? [];

  const roundMap = new Map<string, { label: string; matches: any[] }>();

  for (const m of matches) {
    let key: string;
    let label: string;
    if (m.stage === "GROUP_STAGE") {
      key = `GROUP_STAGE_${m.matchday}`;
      label = `Matchday ${m.matchday}`;
    } else {
      key = m.stage as string;
      label = STAGE_LABELS[m.stage] ?? m.stage;
    }
    if (!roundMap.has(key)) roundMap.set(key, { label, matches: [] });
    roundMap.get(key)!.matches.push({
      id: m.id,
      utcDate: m.utcDate,
      status: m.status,
      group: m.group ? (m.group as string).replace("GROUP_", "Group ") : null,
      homeTeam: m.homeTeam?.id ? { id: m.homeTeam.id, name: m.homeTeam.name, crest: m.homeTeam.crest, sorareSlug: sorareSlugFromFdName(m.homeTeam.name) } : null,
      awayTeam: m.awayTeam?.id ? { id: m.awayTeam.id, name: m.awayTeam.name, crest: m.awayTeam.crest, sorareSlug: sorareSlugFromFdName(m.awayTeam.name) } : null,
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
    });
  }

  const rounds = Array.from(roundMap.entries())
    .map(([id, round]) => {
      const sorted = round.matches.sort((a: any, b: any) => a.utcDate.localeCompare(b.utcDate));
      return {
        id,
        label: round.label,
        startDate: sorted[0]?.utcDate ?? "",
        endDate: sorted[sorted.length - 1]?.utcDate ?? "",
        matches: sorted,
      };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const result = { rounds };
  toCache(cacheKey, result);
  res.json(result);
});

// GET /api/world-cup/teams
// Returns all 48 WC teams from static list (no external API call needed).
router.get("/world-cup/teams", (_req, res): void => {
  res.json({ teams: WC_TEAMS });
});

// POST /api/world-cup/sync
// Seeds/refreshes all 48 WC teams by pulling activePlayers from Sorare's nationalTeam query.
// Safe to re-run: upserts teams and players by sorareSlug, preserves manual exclusions.
router.post("/world-cup/sync", async (_req, res): Promise<void> => {
  await db.insert(competitions).values({
    code: WC_COMPETITION_CODE,
    name: "FIFA World Cup",
    sport: "football",
  }).onConflictDoNothing();

  // Remove coaches that may have been inserted by earlier syncs — must be atomic
  // so team_players rows are never left orphaned if the second delete fails.
  await db.transaction(async (tx) => {
    const coachSlugs = tx.select({ sorareSlug: players.sorareSlug }).from(players).where(eq(players.position, "Coach"));
    await tx.delete(teamPlayers).where(inArray(teamPlayers.sorareSlug, coachSlugs));
    await tx.delete(players).where(eq(players.position, "Coach"));
  });

  const stats = { teams: 0, players: 0, skipped: 0 };

  for (const wcTeam of WC_TEAMS) {
    const [team] = await db.insert(teams).values({
      sorareSlug: wcTeam.slug,
      fdTeamName: wcTeam.name,
      matchConfidence: "exact",
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: teams.sorareSlug,
      set: { fdTeamName: sql`excluded.fd_team_name`, updatedAt: sql`excluded.updated_at` },
    }).returning({ id: teams.id });

    await db.insert(competitionTeams).values({
      competitionCode: WC_COMPETITION_CODE,
      season: WC_SEASON,
      teamId: team.id,
    }).onConflictDoNothing();

    const activePlayers = await fetchActivePlayers(wcTeam.slug);

    for (const p of activePlayers) {
      if (p.position === "Coach") continue;

      const canonicalPosition = p.position ? (SORARE_POSITION[p.position] ?? p.position) : null;

      await db.insert(players).values({
        sorareSlug: p.slug,
        name: p.displayName,
        position: canonicalPosition,
        matchConfidence: "exact",
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: players.sorareSlug,
        set: {
          name: sql`excluded.name`,
          position: sql`excluded.position`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

      // Insert if new; preserve excludedFromSync=true for manually removed players
      await db.insert(teamPlayers).values({
        teamId: team.id,
        sorareSlug: p.slug,
        addedManually: false,
        excludedFromSync: false,
      }).onConflictDoUpdate({
        target: [teamPlayers.teamId, teamPlayers.sorareSlug],
        set: {
          // Never restore a player the user explicitly excluded
          excludedFromSync: sql`team_players.excluded_from_sync`,
          addedManually: sql`team_players.added_manually`,
        },
      });

      stats.players++;
    }

    stats.teams++;
    await new Promise(r => setTimeout(r, 300));
  }

  res.json(stats);
});

// GET /api/world-cup/squad/:sorareSlug
// Returns the squad for a team, reading from DB and enriching with live Sorare stats.
router.get("/world-cup/squad/:sorareSlug", async (req, res): Promise<void> => {
  const sorareSlug = req.params.sorareSlug;

  const cacheKey = `squad:${sorareSlug}`;
  const cached = fromCache<any>(cacheKey, TTL_SQUAD);
  if (cached) { res.json(cached); return; }

  const [team] = await db.select().from(teams).where(eq(teams.sorareSlug, sorareSlug));
  if (!team) { res.status(404).json({ error: "Team not found — run /sync first" }); return; }

  const tpRows = await db
    .select({
      sorareSlug: teamPlayers.sorareSlug,
      addedManually: teamPlayers.addedManually,
      name: players.name,
      position: players.position,
    })
    .from(teamPlayers)
    .leftJoin(players, eq(players.sorareSlug, teamPlayers.sorareSlug))
    .where(and(
      eq(teamPlayers.teamId, team.id),
      eq(teamPlayers.excludedFromSync, false),
      sql`${players.position} IS DISTINCT FROM 'Coach'`,
    ));

  const slugs = tpRows.map(r => r.sorareSlug);
  const liveStats = await fetchLiveStats(slugs);

  const squadPlayers: SquadPlayer[] = tpRows.map(row => ({
    sorareSlug: row.sorareSlug,
    name: row.name ?? row.sorareSlug,
    position: row.position ?? "Unknown",
    addedManually: row.addedManually,
    sorare: liveStats.get(row.sorareSlug) ?? null,
  }));

  const result = {
    teamSlug: team.sorareSlug,
    teamName: team.fdTeamName,
    players: squadPlayers,
  };

  toCache(cacheKey, result);
  res.json(result);
});

// POST /api/world-cup/squad/:sorareSlug/players
// Manually adds a player to a team's squad by their Sorare slug.
router.post("/world-cup/squad/:sorareSlug/players", async (req, res): Promise<void> => {
  const teamSlug = req.params.sorareSlug;
  const { sorareSlug: playerSlug } = req.body;

  if (typeof playerSlug !== "string" || !playerSlug.trim()) {
    res.status(400).json({ error: "sorareSlug is required" }); return;
  }

  const [team] = await db.select().from(teams).where(eq(teams.sorareSlug, teamSlug));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  // Fetch player info from Sorare to confirm slug exists and get display name
  const sorarePlayer = await fetchPlayerBySlug(playerSlug.trim());
  if (!sorarePlayer) { res.status(404).json({ error: "Player not found in Sorare" }); return; }

  const canonicalPosition = sorarePlayer.position
    ? (SORARE_POSITION[sorarePlayer.position] ?? sorarePlayer.position)
    : null;

  await db.transaction(async (tx) => {
    await tx.insert(players).values({
      sorareSlug: sorarePlayer.slug,
      name: sorarePlayer.displayName,
      position: canonicalPosition,
      matchConfidence: "manual",
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: players.sorareSlug,
      set: { name: sql`excluded.name`, updatedAt: sql`excluded.updated_at` },
    });

    await tx.insert(teamPlayers).values({
      teamId: team.id,
      sorareSlug: sorarePlayer.slug,
      addedManually: true,
      excludedFromSync: false,
    }).onConflictDoUpdate({
      target: [teamPlayers.teamId, teamPlayers.sorareSlug],
      set: { excludedFromSync: false, addedManually: true },
    });
  });

  clearByPrefix(`squad:${teamSlug}`);
  res.json({ ok: true, player: { slug: sorarePlayer.slug, displayName: sorarePlayer.displayName } });
});

// DELETE /api/world-cup/squad/:sorareSlug/players/:playerSlug
// Removes a player from a team's squad (sets excludedFromSync=true so re-sync won't restore them).
router.delete("/world-cup/squad/:sorareSlug/players/:playerSlug", async (req, res): Promise<void> => {
  const teamSlug = req.params.sorareSlug;
  const playerSlug = req.params.playerSlug;

  const [team] = await db.select().from(teams).where(eq(teams.sorareSlug, teamSlug));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  await db.update(teamPlayers)
    .set({ excludedFromSync: true })
    .where(and(
      eq(teamPlayers.teamId, team.id),
      eq(teamPlayers.sorareSlug, playerSlug),
    ));

  clearByPrefix(`squad:${teamSlug}`);
  res.json({ ok: true });
});

export default router;
