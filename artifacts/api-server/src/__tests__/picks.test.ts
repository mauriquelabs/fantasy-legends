import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// ── Hoist mocks ───────────────────────────────────────────────────────────────

const getUser = vi.hoisted(() => vi.fn());

vi.mock("../supabaseAdmin.js", () => ({
  supabaseAdmin: { auth: { getUser } },
}));

vi.mock("../lib/logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("../lib/sorare-stats.js", () => ({
  fetchUpcomingFixtures: vi.fn().mockResolvedValue([]),
  fetchFixtureTopPlayers: vi.fn().mockResolvedValue([]),
}));

// Drizzle chain — hoisted so the vi.mock factory can reference it.
const chain = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  innerJoin: vi.fn(),
  leftJoin: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  onConflictDoUpdate: vi.fn(),
  onConflictDoNothing: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: chain,
  leagues: { id: "leagues.id", code: "leagues.code", squadSize: "leagues.squadSize" },
  leagueMembers: { leagueId: "lm.leagueId", userId: "lm.userId" },
  picks: { leagueId: "picks.leagueId", userId: "picks.userId", gameId: "picks.gameId" },
  players: { id: "players.id" },
  games: { sorareId: "games.sorareId", utcDate: "games.utcDate" },
  teams: { id: "teams.id", name: "teams.name", crestUrl: "teams.crestUrl" },
  eq: vi.fn((a, b) => `${String(a)}=${String(b)}`),
  and: vi.fn((...args) => args),
  inArray: vi.fn((col, vals) => `${String(col)} IN (${vals})`),
  between: vi.fn(),
}));

import picksRouter from "../routes/picks.js";

// ── Test app ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use("/api", picksRouter);

function authedAs(id = "user-1", email = "test@example.com") {
  getUser.mockResolvedValueOnce({ data: { user: { id, email } }, error: null });
}

const LEAGUE = { id: 10, squadSize: 5 };
const MEMBERSHIP = [{ leagueId: 10, userId: "user-1" }];
const PLAYERS = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
const FUTURE_GAME = [{ utcDate: new Date(Date.now() + 86_400_000) }]; // tomorrow
const PAST_GAME = [{ utcDate: new Date(Date.now() - 86_400_000) }];   // yesterday
const VALID_IDS = [1, 2, 3, 4, 5];

// The PUT /picks route calls .where() four times in order:
//   1. league lookup  → chains to .limit()
//   2. membership     → chains to .limit()
//   3. players check  → terminal (no .limit())
//   4. game lookup    → chains to .limit()
// Helper: set up chain for tests that need to reach a specific step.
function setupUntilLeague() {
  chain.limit.mockResolvedValueOnce([LEAGUE]);
}
function setupUntilMembership() {
  chain.limit
    .mockResolvedValueOnce([LEAGUE])
    .mockResolvedValueOnce(MEMBERSHIP);
}
function setupUntilPlayers(foundPlayers = PLAYERS) {
  // Queues: where call 1 (league) → chain; call 2 (membership) → chain;
  //          call 3 (players, terminal) → resolves to foundPlayers.
  chain.limit
    .mockResolvedValueOnce([LEAGUE])
    .mockResolvedValueOnce(MEMBERSHIP);
  chain.where
    .mockReturnValueOnce(chain)              // call 1: league
    .mockReturnValueOnce(chain)              // call 2: membership
    .mockResolvedValueOnce(foundPlayers);    // call 3: players (terminal)
}
function setupValidFull() {
  // All four queries succeed; game is in the future.
  chain.limit
    .mockResolvedValueOnce([LEAGUE])
    .mockResolvedValueOnce(MEMBERSHIP)
    .mockResolvedValueOnce(FUTURE_GAME);
  chain.where
    .mockReturnValueOnce(chain)              // league
    .mockReturnValueOnce(chain)              // membership
    .mockResolvedValueOnce(PLAYERS)          // players (terminal)
    .mockReturnValueOnce(chain);             // game (→ limit)
}

beforeEach(() => {
  vi.clearAllMocks();
  chain.select.mockReturnValue(chain);
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.values.mockReturnValue(chain);
  chain.onConflictDoUpdate.mockResolvedValue(undefined);
});

// ── PUT /api/leagues/:code/picks/game/:gameId ──────────────────────────────────

describe("PUT /api/leagues/:code/picks/game/:gameId", () => {
  const url = "/api/leagues/aticco/picks/game/game-001";

  it("returns 401 without a Bearer token", async () => {
    const res = await request(app).put(url).send({ playerIds: VALID_IDS });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the league is not found", async () => {
    authedAs();
    chain.limit.mockResolvedValueOnce([]); // league not found
    const res = await request(app)
      .put(url)
      .set("Authorization", "Bearer tok")
      .send({ playerIds: VALID_IDS });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("League not found");
  });

  it("returns 403 when the user is not a league member", async () => {
    authedAs();
    chain.limit
      .mockResolvedValueOnce([LEAGUE])   // league found
      .mockResolvedValueOnce([]);         // membership empty
    const res = await request(app)
      .put(url)
      .set("Authorization", "Bearer tok")
      .send({ playerIds: VALID_IDS });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Not a member of this league");
  });

  it("returns 400 when playerIds count does not match squadSize", async () => {
    authedAs();
    setupUntilMembership();
    const res = await request(app)
      .put(url)
      .set("Authorization", "Bearer tok")
      .send({ playerIds: [1, 2] }); // only 2, need 5
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/5 player/i);
  });

  it("returns 400 when playerIds contains non-integers", async () => {
    authedAs();
    setupUntilMembership();
    const res = await request(app)
      .put(url)
      .set("Authorization", "Bearer tok")
      .send({ playerIds: [1, 2, 3, "bad", 5] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive integers/i);
  });

  it("returns 400 when some player IDs do not exist in the DB", async () => {
    authedAs();
    setupUntilPlayers([{ id: 1 }, { id: 2 }]); // only 2 of 5 found
    const res = await request(app)
      .put(url)
      .set("Authorization", "Bearer tok")
      .send({ playerIds: VALID_IDS });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it("returns 404 when the game does not exist", async () => {
    authedAs();
    setupUntilPlayers();
    chain.limit.mockResolvedValueOnce([]); // game not found
    chain.where.mockReturnValueOnce(chain); // game query → limit
    const res = await request(app)
      .put(url)
      .set("Authorization", "Bearer tok")
      .send({ playerIds: VALID_IDS });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Game not found");
  });

  it("returns 409 when the game has already started (deadline enforcement)", async () => {
    authedAs();
    // All valid, but game is in the past
    chain.limit
      .mockResolvedValueOnce([LEAGUE])
      .mockResolvedValueOnce(MEMBERSHIP)
      .mockResolvedValueOnce(PAST_GAME);   // game already started
    chain.where
      .mockReturnValueOnce(chain)
      .mockReturnValueOnce(chain)
      .mockResolvedValueOnce(PLAYERS)
      .mockReturnValueOnce(chain);
    const res = await request(app)
      .put(url)
      .set("Authorization", "Bearer tok")
      .send({ playerIds: VALID_IDS });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/locked/i);
  });

  it("returns 200 and saves picks when all inputs are valid", async () => {
    authedAs();
    setupValidFull();
    const res = await request(app)
      .put(url)
      .set("Authorization", "Bearer tok")
      .send({ playerIds: VALID_IDS });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ saved: true, gameId: "game-001", playerIds: VALID_IDS });
    expect(chain.onConflictDoUpdate).toHaveBeenCalledOnce();
  });

  it("allows updating existing picks before the deadline", async () => {
    authedAs();
    setupValidFull();
    const newIds = [5, 4, 3, 2, 1];
    // setupValidFull already queued everything; just override playerIds
    const res = await request(app)
      .put(url)
      .set("Authorization", "Bearer tok")
      .send({ playerIds: newIds });
    expect(res.status).toBe(200);
    expect(res.body.playerIds).toEqual(newIds);
  });
});
