import { Router } from "express";
import { and, between, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, games, leagues, leagueMembers, picks, players, teams, teamPlayers, competitionTeams, competitions } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { fetchUpcomingFixtures, fetchFixtureTopPlayers } from "../lib/sorare-stats.js";

const router = Router();

// GET /api/gameweeks — returns upcoming/ongoing SO5 fixtures from Sorare
router.get("/gameweeks", async (_req, res) => {
  const fixtures = await fetchUpcomingFixtures();
  const wcStart = new Date("2026-06-11");
  return res.json(fixtures.filter(f => new Date(f.startDate) >= wcStart).slice(0, 6));
});

// GET /api/gameweeks/games?start=ISO&end=ISO — games within a date range
router.get("/gameweeks/games", async (req, res) => {
  const start = typeof req.query.start === "string" ? new Date(req.query.start) : null;
  const end = typeof req.query.end === "string" ? new Date(req.query.end) : null;
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ error: "start and end query params required (ISO dates)" });
  }
  const homeTeams = alias(teams, "homeTeam");
  const awayTeams = alias(teams, "awayTeam");
  const rows = await db
    .select({
      sorareId: games.sorareId,
      utcDate: games.utcDate,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      homeTeamCrest: homeTeams.crestUrl,
      awayTeamCrest: awayTeams.crestUrl,
    })
    .from(games)
    .leftJoin(homeTeams, eq(games.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(games.awayTeamId, awayTeams.id))
    .where(between(games.utcDate, start, end))
    .orderBy(games.utcDate);
  return res.json(rows);
});

// GET /api/gameweeks/:slug/top-players — top player scores for a finished fixture
router.get("/gameweeks/:slug/top-players", async (req, res) => {
  const players = await fetchFixtureTopPlayers(String(req.params.slug));
  return res.json(players);
});

// GET /api/games/:gameId/leaderboard — players from both teams ranked by score
router.get("/games/:gameId/leaderboard", async (req, res) => {
  const gameId = String(req.params.gameId);
  const game = await db
    .select({ homeTeamId: games.homeTeamId, awayTeamId: games.awayTeamId })
    .from(games)
    .where(eq(games.sorareId, gameId))
    .limit(1);
  if (!game.length) return res.status(404).json({ error: "Game not found" });
  const teamIds = [game[0].homeTeamId, game[0].awayTeamId].filter((id): id is number => id != null);
  if (!teamIds.length) return res.json([]);

  try {
    const rows = await db
      .selectDistinctOn([players.id], {
        id: players.id,
        name: players.name,
        position: players.position,
        teamName: teams.fdTeamName,
        avg5Score: players.avg5Score,
        recentScores: players.recentScores,
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
          inArray(teamPlayers.teamId, teamIds),
        )
      )
      .orderBy(players.id);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// GET /api/games/:gameId — single game with team details
router.get("/games/:gameId", async (req, res) => {
  const homeTeams = alias(teams, "homeTeam");
  const awayTeams = alias(teams, "awayTeam");
  const rows = await db
    .select({
      sorareId: games.sorareId,
      utcDate: games.utcDate,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      homeTeamCrest: homeTeams.crestUrl,
      awayTeamCrest: awayTeams.crestUrl,
    })
    .from(games)
    .leftJoin(homeTeams, eq(games.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(games.awayTeamId, awayTeams.id))
    .where(eq(games.sorareId, String(req.params.gameId)))
    .limit(1);
  if (!rows.length) return res.status(404).json({ error: "Game not found" });
  return res.json(rows[0]);
});

// GET /api/leagues/:code/picks/gameweek?start=ISO&end=ISO — gameIds the user has picks for
router.get("/leagues/:code/picks/gameweek", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const start = typeof req.query.start === "string" ? new Date(req.query.start) : null;
  const end = typeof req.query.end === "string" ? new Date(req.query.end) : null;
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ error: "start and end query params required (ISO dates)" });
  }

  const league = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(eq(leagues.code, String(req.params.code)))
    .limit(1);
  if (!league.length) return res.status(404).json({ error: "League not found" });

  const gameRows = await db
    .select({ sorareId: games.sorareId })
    .from(games)
    .where(between(games.utcDate, start, end));

  const gameIds = gameRows.map(g => g.sorareId);
  if (!gameIds.length) return res.json({ pickedGameIds: [] });

  const picksRows = await db
    .select({ gameId: picks.gameId })
    .from(picks)
    .where(
      and(
        eq(picks.leagueId, league[0].id),
        eq(picks.userId, user.id),
        inArray(picks.gameId, gameIds),
      )
    );

  return res.json({ pickedGameIds: picksRows.map(p => p.gameId) });
});

// GET /api/leagues/:code/picks/game/:gameId — returns the authed user's picks for a game
router.get("/leagues/:code/picks/game/:gameId", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  const league = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(eq(leagues.code, String(req.params.code)))
    .limit(1);

  if (!league.length) return res.status(404).json({ error: "League not found" });

  const existing = await db
    .select()
    .from(picks)
    .where(
      and(
        eq(picks.leagueId, league[0].id),
        eq(picks.userId, user.id),
        eq(picks.gameId, String(req.params.gameId)),
      )
    )
    .limit(1);

  return res.json(existing[0] ?? null);
});

// PUT /api/leagues/:code/picks/game/:gameId — submit or update picks for a game
router.put("/leagues/:code/picks/game/:gameId", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { playerIds } = req.body as { playerIds?: unknown };
  const gameId = String(req.params.gameId);

  const league = await db
    .select({ id: leagues.id, squadSize: leagues.squadSize })
    .from(leagues)
    .where(eq(leagues.code, String(req.params.code)))
    .limit(1);

  if (!league.length) return res.status(404).json({ error: "League not found" });
  const { id: leagueId, squadSize } = league[0];

  // Must be a member
  const membership = await db
    .select()
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, user.id)))
    .limit(1);

  if (!membership.length) return res.status(403).json({ error: "Not a member of this league" });

  // Validate playerIds
  if (!Array.isArray(playerIds) || playerIds.length !== squadSize) {
    return res.status(400).json({ error: `Exactly ${squadSize} player IDs required` });
  }
  if (!playerIds.every(id => Number.isInteger(id) && id > 0)) {
    return res.status(400).json({ error: "playerIds must be positive integers" });
  }

  // Verify all submitted player IDs exist
  const foundPlayers = await db
    .select({ id: players.id })
    .from(players)
    .where(inArray(players.id, playerIds as number[]));
  if (foundPlayers.length !== squadSize) {
    return res.status(400).json({ error: "One or more player IDs are invalid" });
  }

  // Enforce game deadline using utcDate from DB
  const game = await db
    .select({ utcDate: games.utcDate })
    .from(games)
    .where(eq(games.sorareId, gameId))
    .limit(1);

  if (!game.length) return res.status(404).json({ error: "Game not found" });
  if (new Date() >= game[0].utcDate) {
    return res.status(409).json({ error: "Game has already started — picks are locked" });
  }

  await db
    .insert(picks)
    .values({ leagueId, userId: user.id, gameId, playerIds })
    .onConflictDoUpdate({
      target: [picks.leagueId, picks.userId, picks.gameId],
      set: { playerIds, submittedAt: new Date() },
    });

  return res.json({ saved: true, gameId, playerIds });
});

export default router;
