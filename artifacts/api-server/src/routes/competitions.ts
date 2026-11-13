import { Router, type Request, type Response } from "express";
import {
  db,
  players,
  teams,
  competitions,
  competitionTeams,
  teamPlayers,
  games,
  type Competition,
} from "@workspace/db";
import { SORARE_POSITION } from "@workspace/db/constants";
import { and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { fromCache, toCache } from "../lib/server-cache";
import { logger } from "../lib/logger";
import {
  fdIdToSorareSlug,
  getCompetitionRoster,
  type CompetitionTeamRef,
} from "../data/competition-rosters";

const router = Router();

const SORARE_URL = "https://api.sorare.com/graphql";
const SORARE_AGENT = "Sorare Companion App";
const FD_BASE = "https://api.football-data.org/v4";
const TTL_FIXTURES = 5 * 60 * 1000;
const TTL_STANDINGS = 5 * 60 * 1000;
const DEFAULT_COMPETITION_CODE = "WC";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivePlayer {
  slug: string;
  displayName: string;
  position: string | null;
}

interface SorareGameNode {
  id: string;
  date: string;
  status: string;
  homeTeam: { slug: string; name: string; pictureUrl: string | null } | null;
  awayTeam: { slug: string; name: string; pictureUrl: string | null } | null;
}

import type { SorarePlayerStats as SorarePlayer } from "../lib/sorare-stats";

export interface SquadPlayer {
  sorareSlug: string;
  name: string;
  position: string;
  addedManually: boolean;
  active: boolean;
  sorare: SorarePlayer | null;
}

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function competitionCodeParam(req: Request): string {
  const raw = req.params.code;
  return typeof raw === "string" && raw.length > 0 ? raw : DEFAULT_COMPETITION_CODE;
}

async function findCompetition(code: string): Promise<Competition | undefined> {
  const [row] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.code, code))
    .limit(1);
  return row;
}

async function ensureCompetitionRow(code: string): Promise<Competition> {
  const existing = await findCompetition(code);
  if (existing) return existing;

  if (code === "WC") {
    await db
      .insert(competitions)
      .values({
        code: "WC",
        name: "FIFA World Cup",
        sport: "football",
        season: "2026",
        startsAt: new Date("2026-06-11T00:00:00.000Z"),
        endsAt: new Date("2026-07-19T23:59:59.000Z"),
        fdCode: "WC",
        sorareSlug: "global-cup",
        status: "active",
        displayName: "World Cup 2026",
      })
      .onConflictDoNothing();
    const created = await findCompetition(code);
    if (created) return created;
  }

  throw new Error(`Competition not found: ${code}`);
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

async function fetchSorareCompetitionGames(
  sorareSlug: string,
  field: "futureGames" | "pastGames",
): Promise<SorareGameNode[]> {
  const all: SorareGameNode[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 10; page++) {
    let res: globalThis.Response;
    try {
      res = await fetch(SORARE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": SORARE_AGENT,
        },
        body: JSON.stringify({
          query: `query CompetitionGames($slug: String!, $cursor: String) {
            football {
              competition(slug: $slug) {
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
          variables: { slug: sorareSlug, cursor },
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

// ── Sync ──────────────────────────────────────────────────────────────────────

/**
 * Sync a competition's roster + games.
 * Membership deletes are scoped to competition_teams for this competition only —
 * teams/players used by other competitions are never wiped.
 */
export async function syncCompetition(code: string): Promise<{
  teams: number;
  players: number;
  skipped: number;
  removedMemberships: number;
}> {
  const competition = await ensureCompetitionRow(code);
  const season = competition.season ?? "default";
  const roster: CompetitionTeamRef[] = getCompetitionRoster(code);
  const rosterSlugs = roster.map((t) => t.slug);
  const stats = { teams: 0, players: 0, skipped: 0, removedMemberships: 0 };

  // Remove stale memberships for THIS competition+season only.
  if (rosterSlugs.length > 0) {
    const memberships = await db
      .select({
        teamId: competitionTeams.teamId,
        slug: teams.sorareSlug,
      })
      .from(competitionTeams)
      .innerJoin(teams, eq(teams.id, competitionTeams.teamId))
      .where(
        and(
          eq(competitionTeams.competitionId, competition.id),
          eq(competitionTeams.season, season),
        ),
      );

    const staleIds = memberships
      .filter((m) => !m.slug || !rosterSlugs.includes(m.slug))
      .map((m) => m.teamId);

    if (staleIds.length > 0) {
      await db
        .delete(competitionTeams)
        .where(
          and(
            eq(competitionTeams.competitionId, competition.id),
            eq(competitionTeams.season, season),
            inArray(competitionTeams.teamId, staleIds),
          ),
        );
      stats.removedMemberships = staleIds.length;
    }
  }

  // Remove coaches that may have been inserted by earlier syncs.
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

  const teamSlugToId = new Map<string, number>();

  for (const entry of roster) {
    const [team] = await db
      .insert(teams)
      .values({
        sorareSlug: entry.slug,
        fdTeamId: entry.fdId,
        fdTeamName: entry.name,
        name: entry.name,
        matchConfidence: "exact",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: teams.sorareSlug,
        set: {
          fdTeamId: sql`excluded.fd_team_id`,
          fdTeamName: sql`excluded.fd_team_name`,
          name: sql`excluded.name`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
      .returning({ id: teams.id });

    await db
      .insert(competitionTeams)
      .values({
        competitionId: competition.id,
        season,
        teamId: team.id,
      })
      .onConflictDoNothing();

    const activePlayers = await fetchActivePlayers(entry.slug);

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
            excludedFromSync: sql`team_players.excluded_from_sync`,
            addedManually: sql`team_players.added_manually`,
          },
        });

      stats.players++;
    }

    teamSlugToId.set(entry.slug, team.id);
    stats.teams++;
    await new Promise((r) => setTimeout(r, 300));
  }

  const sorareSlug = competition.sorareSlug;
  if (sorareSlug) {
    try {
      const [futureGames, pastGames] = await Promise.all([
        fetchSorareCompetitionGames(sorareSlug, "futureGames"),
        fetchSorareCompetitionGames(sorareSlug, "pastGames"),
      ]);

      const seasonStart = competition.startsAt
        ? new Date(competition.startsAt)
        : null;
      // Include games from Jan 1 of the start year (or all if unknown)
      const gamesFrom = seasonStart
        ? `${seasonStart.getUTCFullYear()}-01-01`
        : "1970-01-01";

      const allGames = [...futureGames, ...pastGames].filter(
        (g) => g.date >= gamesFrom,
      );

      const teamUpdates = new Map<
        string,
        { name: string; crestUrl: string | null }
      >();
      for (const g of allGames) {
        if (g.homeTeam?.slug) {
          teamUpdates.set(g.homeTeam.slug, {
            name: g.homeTeam.name,
            crestUrl: g.homeTeam.pictureUrl ?? null,
          });
        }
        if (g.awayTeam?.slug) {
          teamUpdates.set(g.awayTeam.slug, {
            name: g.awayTeam.name,
            crestUrl: g.awayTeam.pictureUrl ?? null,
          });
        }
      }
      for (const [slug, update] of teamUpdates) {
        await db
          .update(teams)
          .set({ name: update.name, crestUrl: update.crestUrl })
          .where(eq(teams.sorareSlug, slug));
      }

      for (const g of allGames) {
        const homeTeamId = g.homeTeam?.slug
          ? (teamSlugToId.get(g.homeTeam.slug) ?? null)
          : null;
        const awayTeamId = g.awayTeam?.slug
          ? (teamSlugToId.get(g.awayTeam.slug) ?? null)
          : null;
        await db
          .insert(games)
          .values({
            sorareId: g.id,
            competitionId: competition.id,
            utcDate: new Date(g.date),
            homeTeamId,
            awayTeamId,
          })
          .onConflictDoUpdate({
            target: games.sorareId,
            set: { homeTeamId, awayTeamId, competitionId: competition.id },
          });
      }
    } catch (err) {
      logger.warn(
        { err, code },
        "syncCompetition: games sync failed, teams were synced successfully",
      );
    }
  }

  return stats;
}

/** @deprecated Prefer syncCompetition("WC") */
export async function syncWorldCup(): Promise<{
  teams: number;
  players: number;
  skipped: number;
}> {
  const result = await syncCompetition("WC");
  return {
    teams: result.teams,
    players: result.players,
    skipped: result.skipped,
  };
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function listCompetitions(_req: Request, res: Response): Promise<void> {
  const rows = await db
    .select({
      id: competitions.id,
      code: competitions.code,
      name: competitions.name,
      displayName: competitions.displayName,
      sport: competitions.sport,
      season: competitions.season,
      startsAt: competitions.startsAt,
      endsAt: competitions.endsAt,
      status: competitions.status,
      fdCode: competitions.fdCode,
      sorareSlug: competitions.sorareSlug,
    })
    .from(competitions)
    .orderBy(competitions.startsAt);

  res.json({
    competitions: rows.map((r) => ({
      ...r,
      displayName: r.displayName ?? r.name,
    })),
  });
}

async function getCompetition(req: Request, res: Response): Promise<void> {
  const code = competitionCodeParam(req);
  const row = await findCompetition(code);
  if (!row) {
    res.status(404).json({ error: "Competition not found" });
    return;
  }
  res.json({
    ...row,
    displayName: row.displayName ?? row.name,
  });
}

async function getFixtures(req: Request, res: Response): Promise<void> {
  const code = competitionCodeParam(req);
  const cacheKey = `comp:${code}:fixtures`;
  const cached = fromCache<any>(cacheKey, TTL_FIXTURES);
  if (cached) {
    res.json(cached);
    return;
  }

  const comp = await findCompetition(code);
  if (!comp) {
    res.json({ rounds: [] });
    return;
  }

  const homeTeams = alias(teams, "home_team");
  const awayTeams = alias(teams, "away_team");

  const rows = await db
    .select({
      sorareId: games.sorareId,
      utcDate: games.utcDate,
      homeTeamSlug: homeTeams.sorareSlug,
      homeTeamName: homeTeams.name,
      homeTeamCrest: homeTeams.crestUrl,
      awayTeamSlug: awayTeams.sorareSlug,
      awayTeamName: awayTeams.name,
      awayTeamCrest: awayTeams.crestUrl,
    })
    .from(games)
    .leftJoin(homeTeams, eq(games.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(games.awayTeamId, awayTeams.id))
    .where(eq(games.competitionId, comp.id))
    .orderBy(games.utcDate);

  const now = Date.now();
  const roundMap = new Map<string, { label: string; matches: any[] }>();

  for (const row of rows) {
    const dateKey = row.utcDate.toISOString().slice(0, 10);
    if (!roundMap.has(dateKey)) {
      const label = row.utcDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      roundMap.set(dateKey, { label, matches: [] });
    }
    const minutesSince = (now - row.utcDate.getTime()) / 60000;
    const status =
      minutesSince > 150
        ? "FINISHED"
        : minutesSince > 0
          ? "IN_PLAY"
          : "SCHEDULED";
    roundMap.get(dateKey)!.matches.push({
      id: row.sorareId,
      utcDate: row.utcDate.toISOString(),
      status,
      group: null,
      homeTeam: row.homeTeamSlug
        ? {
            name: row.homeTeamName,
            crest: row.homeTeamCrest,
            sorareSlug: row.homeTeamSlug,
          }
        : null,
      awayTeam: row.awayTeamSlug
        ? {
            name: row.awayTeamName,
            crest: row.awayTeamCrest,
            sorareSlug: row.awayTeamSlug,
          }
        : null,
      homeScore: null,
      awayScore: null,
    });
  }

  const rounds = Array.from(roundMap.entries()).map(([id, round]) => ({
    id,
    label: round.label,
    startDate: round.matches[0]?.utcDate ?? "",
    endDate: round.matches[round.matches.length - 1]?.utcDate ?? "",
    matches: round.matches,
  }));

  const result = { rounds };
  toCache(cacheKey, result);
  res.json(result);
}

async function getTeams(req: Request, res: Response): Promise<void> {
  const code = competitionCodeParam(req);
  const dbTeams = await db
    .select({
      slug: teams.sorareSlug,
      name: teams.name,
      pictureUrl: teams.crestUrl,
    })
    .from(teams)
    .innerJoin(competitionTeams, eq(competitionTeams.teamId, teams.id))
    .innerJoin(
      competitions,
      eq(competitions.id, competitionTeams.competitionId),
    )
    .where(eq(competitions.code, code))
    .orderBy(teams.name);

  if (!dbTeams.length) {
    res.status(404).json({ error: "No teams found — run /sync first" });
    return;
  }

  res.json({ teams: dbTeams });
}

async function getStandings(req: Request, res: Response): Promise<void> {
  const code = competitionCodeParam(req);
  const cacheKey = `comp:${code}:standings`;
  const cached = fromCache<any>(cacheKey, TTL_STANDINGS);
  if (cached) {
    res.json(cached);
    return;
  }

  const comp = await findCompetition(code);
  // Prefer configured fdCode; fall back to competition code (WC → WC).
  const fdCode = comp?.fdCode ?? code;

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "FOOTBALL_DATA_API_KEY not set" });
    return;
  }

  let fdRes: globalThis.Response;
  try {
    fdRes = await fetch(`${FD_BASE}/competitions/${fdCode}/standings`, {
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

  const slugByFdId = fdIdToSorareSlug(code);
  const data: any = await fdRes.json();
  const standings: any[] = data.standings ?? [];

  const groups: StandingGroup[] = standings
    .filter((s: any) => s.type === "TOTAL")
    .map((s: any) => {
      const groupKey: string = s.group ?? "";
      const label = groupKey.replace("GROUP_", "Group ");
      const table: StandingRow[] = (s.table ?? []).map((row: any) => ({
        position: row.position,
        sorareSlug: slugByFdId.get(row.team?.id) ?? null,
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
}

async function postSync(req: Request, res: Response): Promise<void> {
  const code = competitionCodeParam(req);
  try {
    const stats = await syncCompetition(code);
    res.json(stats);
  } catch (err) {
    logger.error({ err, code }, "competition sync failed");
    res.status(404).json({
      error: err instanceof Error ? err.message : "Sync failed",
    });
  }
}

async function getSquad(req: Request, res: Response): Promise<void> {
  const sorareSlug = String(req.params.sorareSlug);

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
      excludedFromSync: teamPlayers.excludedFromSync,
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
    active: !row.excludedFromSync,
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
}

async function addSquadPlayer(req: Request, res: Response): Promise<void> {
  const teamSlug = String(req.params.sorareSlug);
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
}

async function deactivateSquadPlayer(
  req: Request,
  res: Response,
): Promise<void> {
  const teamSlug = String(req.params.sorareSlug);
  const playerSlug = String(req.params.playerSlug);

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.sorareSlug, teamSlug));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const updated = await db
    .update(teamPlayers)
    .set({ excludedFromSync: true })
    .where(
      and(
        eq(teamPlayers.teamId, team.id),
        eq(teamPlayers.sorareSlug, playerSlug),
      ),
    )
    .returning();

  if (!updated.length) {
    res.status(404).json({ error: "Player not found in squad" });
    return;
  }

  res.json({ ok: true });
}

async function restoreSquadPlayer(req: Request, res: Response): Promise<void> {
  const teamSlug = String(req.params.sorareSlug);
  const playerSlug = String(req.params.playerSlug);

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.sorareSlug, teamSlug));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const updated = await db
    .update(teamPlayers)
    .set({ excludedFromSync: false })
    .where(
      and(
        eq(teamPlayers.teamId, team.id),
        eq(teamPlayers.sorareSlug, playerSlug),
      ),
    )
    .returning();

  if (!updated.length) {
    res.status(404).json({ error: "Player not found in squad" });
    return;
  }

  res.json({ ok: true });
}

// ── Routes: /api/competitions ─────────────────────────────────────────────────

router.get("/competitions", listCompetitions);
router.get("/competitions/:code", getCompetition);
router.get("/competitions/:code/fixtures", getFixtures);
router.get("/competitions/:code/teams", getTeams);
router.get("/competitions/:code/standings", getStandings);
router.post("/competitions/:code/sync", postSync);
router.get("/competitions/:code/squad/:sorareSlug", getSquad);
router.post("/competitions/:code/squad/:sorareSlug/players", addSquadPlayer);
router.delete(
  "/competitions/:code/squad/:sorareSlug/players/:playerSlug",
  deactivateSquadPlayer,
);
router.post(
  "/competitions/:code/squad/:sorareSlug/players/:playerSlug/restore",
  restoreSquadPlayer,
);

// ── Legacy aliases: /api/world-cup/* → WC ─────────────────────────────────────

function withWcCode(
  handler: (req: Request, res: Response) => Promise<void>,
) {
  return (req: Request, res: Response) => {
    req.params.code = DEFAULT_COMPETITION_CODE;
    return handler(req, res);
  };
}

router.get("/world-cup/fixtures", withWcCode(getFixtures));
router.get("/world-cup/teams", withWcCode(getTeams));
router.get("/world-cup/standings", withWcCode(getStandings));
router.post("/world-cup/sync", withWcCode(postSync));
router.get("/world-cup/squad/:sorareSlug", getSquad);
router.post("/world-cup/squad/:sorareSlug/players", addSquadPlayer);
router.delete(
  "/world-cup/squad/:sorareSlug/players/:playerSlug",
  deactivateSquadPlayer,
);
router.post(
  "/world-cup/squad/:sorareSlug/players/:playerSlug/restore",
  restoreSquadPlayer,
);

export default router;
