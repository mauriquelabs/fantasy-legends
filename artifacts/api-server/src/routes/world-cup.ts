import { Router } from "express";
import {
  db,
  players,
  teams,
  competitions,
  competitionTeams,
  teamPlayers,
} from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { fromCache, toCache } from "../lib/server-cache";

const router = Router();

const SORARE_URL = "https://api.sorare.com/graphql";
const SORARE_AGENT = "Sorare Companion App";
const WC_COMPETITION_CODE = "WC";
const WC_SEASON = "2026";

// All 48 WC 2026 teams — sorare slug + football-data.org team ID (fdId).
// fdId is used to map FD standings/fixtures back to Sorare slugs without
// relying on fragile name matching.
const WC_TEAMS = [
  // UEFA (16)
  { slug: "france",             name: "France",             fdId: 773  },
  { slug: "spain",              name: "Spain",              fdId: 760  },
  { slug: "england",            name: "England",            fdId: 770  },
  { slug: "germany",            name: "Germany",            fdId: 759  },
  { slug: "portugal",           name: "Portugal",           fdId: 765  },
  { slug: "netherlands",        name: "Netherlands",        fdId: 8601 },
  { slug: "belgium",            name: "Belgium",            fdId: 805  },
  { slug: "croatia",            name: "Croatia",            fdId: 799  },
  { slug: "switzerland",        name: "Switzerland",        fdId: 788  },
  { slug: "austria",            name: "Austria",            fdId: 816  },
  { slug: "turkey",             name: "Turkey",             fdId: 803  },
  { slug: "scotland",           name: "Scotland",           fdId: 8873 },
  { slug: "norway",             name: "Norway",             fdId: 8872 },
  { slug: "sweden",             name: "Sweden",             fdId: 792  },
  { slug: "czech-republic",     name: "Czechia",            fdId: 798  },
  { slug: "bosnia-herzegovina", name: "Bosnia & Herzegovina", fdId: 1060 },
  // CONMEBOL (6)
  { slug: "argentina",          name: "Argentina",          fdId: 762  },
  { slug: "brazil",             name: "Brazil",             fdId: 764  },
  { slug: "colombia",           name: "Colombia",           fdId: 818  },
  { slug: "uruguay",            name: "Uruguay",            fdId: 758  },
  { slug: "ecuador",            name: "Ecuador",            fdId: 791  },
  { slug: "paraguay",           name: "Paraguay",           fdId: 761  },
  // CONCACAF (6)
  { slug: "united-states",      name: "United States",      fdId: 771  },
  { slug: "mexico",             name: "Mexico",             fdId: 769  },
  { slug: "canada",             name: "Canada",             fdId: 828  },
  { slug: "panama",             name: "Panama",             fdId: 1836 },
  { slug: "haiti",              name: "Haiti",              fdId: 836  },
  { slug: "curacao",            name: "Curaçao",            fdId: 9460 },
  // CAF (9)
  { slug: "morocco",            name: "Morocco",            fdId: 815  },
  { slug: "senegal",            name: "Senegal",            fdId: 804  },
  { slug: "egypt",              name: "Egypt",              fdId: 825  },
  { slug: "cote-d-ivoire",      name: "Côte d'Ivoire",      fdId: 1935 },
  { slug: "south-africa",       name: "South Africa",       fdId: 774  },
  { slug: "tunisia",            name: "Tunisia",            fdId: 802  },
  { slug: "ghana",              name: "Ghana",              fdId: 763  },
  { slug: "algeria",            name: "Algeria",            fdId: 778  },
  { slug: "congo-dr",           name: "Congo DR",           fdId: 1934 },
  // AFC (8)
  { slug: "japan",              name: "Japan",              fdId: 766  },
  { slug: "korea-republic",     name: "South Korea",        fdId: 772  },
  { slug: "iran",               name: "Iran",               fdId: 840  },
  { slug: "australia",          name: "Australia",          fdId: 779  },
  { slug: "saudi-arabia",       name: "Saudi Arabia",       fdId: 801  },
  { slug: "iraq",               name: "Iraq",               fdId: 8062 },
  { slug: "jordan",             name: "Jordan",             fdId: 8049 },
  { slug: "uzbekistan",         name: "Uzbekistan",         fdId: 8070 },
  // OFC (1)
  { slug: "new-zealand",        name: "New Zealand",        fdId: 783  },
  // AFC inter-confederation playoff winner
  { slug: "qatar",              name: "Qatar",              fdId: 8030 },
  // CONCACAF inter-confederation playoff winner
  { slug: "cape-verde-islands", name: "Cape Verde",         fdId: 1930 },
];

// fdId → Sorare slug lookup, built from WC_TEAMS at module load time.
const FD_ID_TO_SORARE_SLUG = new Map<number, string>(
  WC_TEAMS.map((t) => [t.fdId, t.slug]),
);

// Maps Sorare position values to canonical display names
const SORARE_POSITION: Record<string, string> = {
  Goalkeeper: "Goalkeeper",
  Defender: "Defence",
  Midfielder: "Midfield",
  Forward: "Offence",
};

// ── Sorare ────────────────────────────────────────────────────────────────────

import type { SorarePlayerStats as SorarePlayer } from "../lib/sorare-stats";

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
        headers: {
          "Content-Type": "application/json",
          "User-Agent": SORARE_AGENT,
        },
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
        console.warn(
          `Sorare error fetching activePlayers for ${teamSlug}:`,
          json.errors,
        );
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

async function fetchPlayerBySlug(
  slug: string,
): Promise<{ slug: string; displayName: string; position: string } | null> {
  try {
    const res = await fetch(SORARE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": SORARE_AGENT,
      },
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

const TTL_FIXTURES = 5 * 60 * 1000;

interface SorareGameNode {
  id: string;
  date: string;
  status: string;
  homeTeam: { slug: string; name: string; pictureUrl: string | null } | null;
  awayTeam: { slug: string; name: string; pictureUrl: string | null } | null;
}

async function fetchSorareWCGames(
  field: "futureGames" | "pastGames",
): Promise<SorareGameNode[]> {
  const all: SorareGameNode[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 10; page++) {
    let res: Response;
    try {
      res = await fetch(SORARE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": SORARE_AGENT,
        },
        body: JSON.stringify({
          query: `query CompetitionGames($cursor: String) {
            football {
              competition(slug: "global-cup") {
                ${field}(first: 25, after: $cursor) {
                  nodes {
                    id
                    date
                    homeTeam { slug name pictureUrl }
                    awayTeam { slug name pictureUrl }
                  }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
          }`,
          variables: { cursor },
        }),
      });
    } catch {
      console.warn(`Sorare ${field}: network error`);
      break;
    }

    let json: any;
    try {
      json = await res.json();
    } catch {
      console.warn(`Sorare ${field}: malformed JSON response`);
      break;
    }
    if (json.errors) {
      console.warn(`Sorare ${field} error:`, json.errors);
      break;
    }

    const pageData = json?.data?.football?.competition?.[field];
    if (!pageData) break;
    all.push(...(pageData.nodes ?? []));
    if (!pageData.pageInfo?.hasNextPage) break;
    cursor = pageData.pageInfo.endCursor;
  }

  return all;
}

// GET /api/world-cup/fixtures
// Returns WC 2026 schedule from Sorare (past + future games), grouped by calendar date.
router.get("/world-cup/fixtures", async (_req, res): Promise<void> => {
  const cacheKey = "wc:fixtures";
  const cached = fromCache<any>(cacheKey, TTL_FIXTURES);
  if (cached) {
    res.json(cached);
    return;
  }

  let futureGames: SorareGameNode[];
  let pastGames: SorareGameNode[];
  try {
    [futureGames, pastGames] = await Promise.all([
      fetchSorareWCGames("futureGames"),
      fetchSorareWCGames("pastGames"),
    ]);
  } catch {
    res.status(502).json({ error: "Sorare unreachable" });
    return;
  }

  const now = Date.now();
  const allGames = [
    ...pastGames
      .filter((g) => g.date >= "2026-01-01")
      .map((g) => ({ ...g, _status: "FINISHED" })),
    ...futureGames
      .filter((g) => g.date >= "2026-01-01")
      .map((g) => {
        const minutesSinceKickoff = (now - new Date(g.date).getTime()) / 60000;
        const _status =
          minutesSinceKickoff > 0 && minutesSinceKickoff < 150
            ? "IN_PLAY"
            : "SCHEDULED";
        return { ...g, _status };
      }),
  ];

  const roundMap = new Map<string, { label: string; matches: any[] }>();

  for (const g of allGames) {
    const dateKey = (g.date as string).slice(0, 10); // YYYY-MM-DD
    if (!roundMap.has(dateKey)) {
      const d = new Date(g.date);
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      roundMap.set(dateKey, { label, matches: [] });
    }
    roundMap.get(dateKey)!.matches.push({
      id: g.id,
      utcDate: g.date,
      status: g._status,
      group: null,
      homeTeam: g.homeTeam
        ? {
            name: g.homeTeam.name,
            crest: g.homeTeam.pictureUrl,
            sorareSlug: g.homeTeam.slug,
          }
        : null,
      awayTeam: g.awayTeam
        ? {
            name: g.awayTeam.name,
            crest: g.awayTeam.pictureUrl,
            sorareSlug: g.awayTeam.slug,
          }
        : null,
      homeScore: null,
      awayScore: null,
    });
  }

  const rounds = Array.from(roundMap.entries())
    .map(([id, round]) => {
      const sorted = round.matches.sort((a: any, b: any) =>
        a.utcDate.localeCompare(b.utcDate),
      );
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

const TTL_TEAMS = 24 * 60 * 60 * 1000;

async function fetchSorareWCTeams(): Promise<
  { slug: string; name: string; pictureUrl: string | null }[]
> {
  const res = await fetch(SORARE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
    body: JSON.stringify({
      query: `query WorldCupTeams {
        football {
          competition(slug: "global-cup") {
            teams(first: 64) {
              nodes { slug name pictureUrl }
            }
          }
        }
      }`,
    }),
  });
  if (!res.ok) throw new Error(`Sorare returned ${res.status}`);
  const json: any = await res.json();
  if (json.errors)
    throw new Error(json.errors[0]?.message ?? "Sorare GraphQL error");
  return json?.data?.football?.competition?.teams?.nodes ?? [];
}

// GET /api/world-cup/teams
// Fetches the team list from Sorare's global-cup competition, enriches with
// flag + confederation from a static map, and caches for 24h.
router.get("/world-cup/teams", async (_req, res): Promise<void> => {
  const cacheKey = "wc:teams";
  const cached = fromCache<any>(cacheKey, TTL_TEAMS);
  if (cached) {
    res.json(cached);
    return;
  }

  let sorareTeams: { slug: string; name: string; pictureUrl: string | null }[];
  try {
    sorareTeams = await fetchSorareWCTeams();
  } catch (err) {
    console.error("fetchSorareWCTeams failed:", err);
    res.status(502).json({ error: "Failed to fetch teams from Sorare" });
    return;
  }

  const result = { teams: sorareTeams };
  toCache(cacheKey, result);
  res.json(result);
});

// GET /api/world-cup/standings
// Returns WC 2026 group standings from football-data.org, with each team
// enriched with their Sorare slug via the FD_ID_TO_SORARE_SLUG map.
const FD_BASE = "https://api.football-data.org/v4";
const TTL_STANDINGS = 5 * 60 * 1000;

export interface StandingRow {
  position: number;
  sorareSlug: string | null;
  name: string;
  crest: string | null;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface StandingGroup {
  group: string;
  label: string;
  table: StandingRow[];
}

router.get("/world-cup/standings", async (_req, res): Promise<void> => {
  const cacheKey = "wc:standings";
  const cached = fromCache<any>(cacheKey, TTL_STANDINGS);
  if (cached) {
    res.json(cached);
    return;
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "FOOTBALL_DATA_API_KEY not set" });
    return;
  }

  let fdRes: Response;
  try {
    fdRes = await fetch(`${FD_BASE}/competitions/WC/standings`, {
      headers: { "X-Auth-Token": apiKey },
    });
  } catch {
    res.status(502).json({ error: "football-data.org unreachable" });
    return;
  }

  if (!fdRes.ok) {
    res.status(502).json({ error: `football-data.org returned ${fdRes.status}` });
    return;
  }

  const data: any = await fdRes.json();
  const standings: any[] = data.standings ?? [];

  const groups: StandingGroup[] = standings
    .filter((s: any) => s.type === "TOTAL")
    .map((s: any) => {
      const groupKey: string = s.group ?? "";
      const label = groupKey.replace("GROUP_", "Group ");
      const table: StandingRow[] = (s.table ?? []).map((row: any) => ({
        position: row.position,
        sorareSlug: FD_ID_TO_SORARE_SLUG.get(row.team?.id) ?? null,
        name: row.team?.name ?? "",
        crest: row.team?.crest ?? null,
        playedGames: row.playedGames,
        won: row.won,
        draw: row.draw,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        points: row.points,
      }));
      return { group: groupKey, label, table };
    })
    .sort((a, b) => a.group.localeCompare(b.group));

  const result = { groups };
  toCache(cacheKey, result);
  res.json(result);
});

// POST /api/world-cup/sync
// Seeds/refreshes all 48 WC teams by pulling activePlayers from Sorare's nationalTeam query.
// Safe to re-run: upserts teams and players by sorareSlug, preserves manual exclusions.
export async function syncWorldCup(): Promise<{
  teams: number;
  players: number;
  skipped: number;
}> {
  await db
    .insert(competitions)
    .values({
      code: WC_COMPETITION_CODE,
      name: "FIFA World Cup",
      sport: "football",
    })
    .onConflictDoNothing();

  // Remove coaches that may have been inserted by earlier syncs — must be atomic
  // so team_players rows are never left orphaned if the second delete fails.
  await db.transaction(async (tx) => {
    const coachSlugs = tx
      .select({ sorareSlug: players.sorareSlug })
      .from(players)
      .where(eq(players.position, "Coach"));
    await tx
      .delete(teamPlayers)
      .where(inArray(teamPlayers.sorareSlug, coachSlugs));
    await tx.delete(players).where(eq(players.position, "Coach"));
  });

  const stats = { teams: 0, players: 0, skipped: 0 };

  for (const wcTeam of WC_TEAMS) {
    const [team] = await db
      .insert(teams)
      .values({
        sorareSlug: wcTeam.slug,
        fdTeamName: wcTeam.name,
        matchConfidence: "exact",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: teams.sorareSlug,
        set: {
          fdTeamName: sql`excluded.fd_team_name`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
      .returning({ id: teams.id });

    await db
      .insert(competitionTeams)
      .values({
        competitionCode: WC_COMPETITION_CODE,
        season: WC_SEASON,
        teamId: team.id,
      })
      .onConflictDoNothing();

    const activePlayers = await fetchActivePlayers(wcTeam.slug);

    for (const p of activePlayers) {
      if (p.position === "Coach") continue;

      const canonicalPosition = p.position
        ? (SORARE_POSITION[p.position] ?? p.position)
        : null;

      await db
        .insert(players)
        .values({
          sorareSlug: p.slug,
          name: p.displayName,
          position: canonicalPosition,
          matchConfidence: "exact",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: players.sorareSlug,
          set: {
            name: sql`excluded.name`,
            position: sql`excluded.position`,
            updatedAt: sql`excluded.updated_at`,
          },
        });

      // Insert if new; preserve excludedFromSync=true for manually removed players
      await db
        .insert(teamPlayers)
        .values({
          teamId: team.id,
          sorareSlug: p.slug,
          addedManually: false,
          excludedFromSync: false,
        })
        .onConflictDoUpdate({
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
    await new Promise((r) => setTimeout(r, 300));
  }

  return stats;
}

router.post("/world-cup/sync", async (_req, res): Promise<void> => {
  const stats = await syncWorldCup();
  res.json(stats);
});

// GET /api/world-cup/squad/:sorareSlug
// Returns the squad for a team, reading all data (scores + club) from the synced DB.
router.get("/world-cup/squad/:sorareSlug", async (req, res): Promise<void> => {
  const sorareSlug = req.params.sorareSlug;

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.sorareSlug, sorareSlug));
  if (!team) {
    res.status(404).json({ error: "Team not found — run /sync first" });
    return;
  }

  const tpRows = await db
    .select({
      sorareSlug: teamPlayers.sorareSlug,
      addedManually: teamPlayers.addedManually,
      name: players.name,
      position: players.position,
      avgScore: players.avgScore,
      avg5Score: players.avg5Score,
      avg40Score: players.avg40Score,
      recentScores: players.recentScores,
      gamesPlayedLast15: players.gamesPlayedLast15,
      currentClub: players.currentClub,
      scoresUpdatedAt: players.scoresUpdatedAt,
    })
    .from(teamPlayers)
    .leftJoin(players, eq(players.sorareSlug, teamPlayers.sorareSlug))
    .where(
      and(
        eq(teamPlayers.teamId, team.id),
        eq(teamPlayers.excludedFromSync, false),
        sql`${players.position} IS DISTINCT FROM 'Coach'`,
      ),
    );

  const squadPlayers: SquadPlayer[] = tpRows.map((row) => ({
    sorareSlug: row.sorareSlug,
    name: row.name ?? row.sorareSlug,
    position: row.position
      ? (SORARE_POSITION[row.position] ?? row.position)
      : "Unknown",
    addedManually: row.addedManually,
    sorare:
      row.scoresUpdatedAt != null
        ? {
            slug: row.sorareSlug,
            displayName: row.name ?? row.sorareSlug,
            position: row.position ?? "",
            avgScore: row.avgScore ?? null,
            avg5Score: row.avg5Score ?? null,
            avg40Score: row.avg40Score ?? null,
            recentScores: (row.recentScores ?? []) as number[],
            gamesPlayedLast15: row.gamesPlayedLast15 ?? 0,
            currentClub: row.currentClub ?? null,
          }
        : null,
  }));

  res.json({
    teamSlug: team.sorareSlug,
    teamName: team.fdTeamName,
    players: squadPlayers,
  });
});

// POST /api/world-cup/squad/:sorareSlug/players
// Manually adds a player to a team's squad by their Sorare slug.
router.post(
  "/world-cup/squad/:sorareSlug/players",
  async (req, res): Promise<void> => {
    const teamSlug = req.params.sorareSlug;
    const { sorareSlug: playerSlug } = req.body;

    if (typeof playerSlug !== "string" || !playerSlug.trim()) {
      res.status(400).json({ error: "sorareSlug is required" });
      return;
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.sorareSlug, teamSlug));
    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    // Fetch player info from Sorare to confirm slug exists and get display name
    const sorarePlayer = await fetchPlayerBySlug(playerSlug.trim());
    if (!sorarePlayer) {
      res.status(404).json({ error: "Player not found in Sorare" });
      return;
    }

    const canonicalPosition = sorarePlayer.position
      ? (SORARE_POSITION[sorarePlayer.position] ?? sorarePlayer.position)
      : null;

    await db.transaction(async (tx) => {
      await tx
        .insert(players)
        .values({
          sorareSlug: sorarePlayer.slug,
          name: sorarePlayer.displayName,
          position: canonicalPosition,
          matchConfidence: "manual",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: players.sorareSlug,
          set: {
            name: sql`excluded.name`,
            updatedAt: sql`excluded.updated_at`,
          },
        });

      await tx
        .insert(teamPlayers)
        .values({
          teamId: team.id,
          sorareSlug: sorarePlayer.slug,
          addedManually: true,
          excludedFromSync: false,
        })
        .onConflictDoUpdate({
          target: [teamPlayers.teamId, teamPlayers.sorareSlug],
          set: { excludedFromSync: false, addedManually: true },
        });
    });

    res.json({
      ok: true,
      player: {
        slug: sorarePlayer.slug,
        displayName: sorarePlayer.displayName,
      },
    });
  },
);

// DELETE /api/world-cup/squad/:sorareSlug/players/:playerSlug
// Removes a player from a team's squad (sets excludedFromSync=true so re-sync won't restore them).
router.delete(
  "/world-cup/squad/:sorareSlug/players/:playerSlug",
  async (req, res): Promise<void> => {
    const teamSlug = req.params.sorareSlug;
    const playerSlug = req.params.playerSlug;

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.sorareSlug, teamSlug));
    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    await db
      .update(teamPlayers)
      .set({ excludedFromSync: true })
      .where(
        and(
          eq(teamPlayers.teamId, team.id),
          eq(teamPlayers.sorareSlug, playerSlug),
        ),
      );

    res.json({ ok: true });
  },
);

export default router;
