import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

// ── Mock db ───────────────────────────────────────────────────────────────────

const dbState = vi.hoisted(() => ({ results: [] as any[], call: 0 }));

vi.mock("@workspace/db", () => {
  function chain(val: any): any {
    const node: any = { then: (ok: any, fail?: any) => Promise.resolve(val).then(ok, fail) };
    for (const m of ["from", "where", "leftJoin", "innerJoin", "values", "set",
                     "onConflictDoNothing", "onConflictDoUpdate", "returning", "orderBy"]) {
      node[m] = () => chain(val);
    }
    return node;
  }
  const db: any = {
    select: vi.fn(() => chain(dbState.results[dbState.call++] ?? [])),
    insert: vi.fn(() => chain([])),
    update: vi.fn(() => chain([])),
    delete: vi.fn(() => chain([])),
    transaction: vi.fn((fn: any) => fn(db)),
  };
  return { db, players: {}, teams: {}, competitions: {}, competitionTeams: {}, teamPlayers: {}, games: {} };
});

// alias() from drizzle-orm/pg-core requires a real PgTable — stub it out since
// the db mock ignores all query arguments anyway.
vi.mock("drizzle-orm/pg-core", async (importOriginal) => {
  const mod = await importOriginal<typeof import("drizzle-orm/pg-core")>();
  return { ...mod, alias: (table: any) => table };
});

vi.mock("../lib/server-cache", () => ({
  fromCache: vi.fn(() => null),
  toCache: vi.fn(),
  clearByPrefix: vi.fn(),
}));

import { db } from "@workspace/db";
import worldCupRouter from "../routes/world-cup.js";

// Replicates the chain helper from the db mock so individual tests can override return values.
function chainWith(val: any): any {
  const node: any = { then: (ok: any, fail?: any) => Promise.resolve(val).then(ok, fail) };
  for (const m of ["from", "where", "leftJoin", "innerJoin", "values", "set",
                   "onConflictDoNothing", "onConflictDoUpdate", "returning", "orderBy"]) {
    node[m] = () => chainWith(val);
  }
  return node;
}

const app = express();
app.use(express.json());
app.use("/api", worldCupRouter);

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(dbState, { results: [], call: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── GET /api/world-cup/teams ──────────────────────────────────────────────────

describe("GET /api/world-cup/teams", () => {
  it("returns teams from the database", async () => {
    dbState.results = [[
      { slug: "argentina", name: "Argentina", pictureUrl: "https://example.com/arg.png" },
      { slug: "france", name: "France", pictureUrl: null },
    ]];
    const res = await request(app).get("/api/world-cup/teams");
    expect(res.status).toBe(200);
    expect(res.body.teams).toHaveLength(2);
    expect(res.body.teams[0]).toMatchObject({ slug: "argentina", name: "Argentina", pictureUrl: "https://example.com/arg.png" });
    expect(res.body.teams[1]).toMatchObject({ slug: "france", name: "France", pictureUrl: null });
  });

  it("returns 404 when no teams are in the database", async () => {
    dbState.results = [[]];
    const res = await request(app).get("/api/world-cup/teams");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no teams found/i);
  });
});

// ── GET /api/world-cup/fixtures ───────────────────────────────────────────────

// The fixtures route reads from the DB: first fetches the WC competition row,
// then joins games+teams. Status is derived from utcDate vs now (>150min = FINISHED).
function dbGame(
  sorareId: string,
  utcDate: Date,
  home: { slug: string; name: string; crest?: string | null },
  away: { slug: string; name: string; crest?: string | null },
) {
  return {
    sorareId,
    utcDate,
    homeTeamSlug: home.slug, homeTeamName: home.name, homeTeamCrest: home.crest ?? null,
    awayTeamSlug: away.slug, awayTeamName: away.name, awayTeamCrest: away.crest ?? null,
  };
}

describe("GET /api/world-cup/fixtures", () => {
  it("returns empty rounds when competition is not in the database", async () => {
    // dbState.results is empty by default — competition select returns [] → early return
    const res = await request(app).get("/api/world-cup/fixtures");
    expect(res.status).toBe(200);
    expect(res.body.rounds).toEqual([]);
  });

  it("groups games by calendar date and marks status correctly", async () => {
    dbState.results = [
      [{ id: 1 }],
      [
        dbGame("g0", new Date("2022-11-20T16:00:00Z"),
          { slug: "morocco", name: "Morocco" }, { slug: "germany", name: "Germany" }),
        dbGame("g1", new Date("2030-06-15T16:00:00Z"),
          { slug: "france", name: "France" }, { slug: "argentina", name: "Argentina" }),
      ],
    ];

    const res = await request(app).get("/api/world-cup/fixtures");
    expect(res.status).toBe(200);
    expect(res.body.rounds).toHaveLength(2);

    const finishedRound = res.body.rounds[0];
    expect(finishedRound.id).toBe("2022-11-20");
    expect(finishedRound.matches[0].status).toBe("FINISHED");
    expect(finishedRound.matches[0].homeTeam.sorareSlug).toBe("morocco");

    const scheduledRound = res.body.rounds[1];
    expect(scheduledRound.id).toBe("2030-06-15");
    expect(scheduledRound.matches[0].status).toBe("SCHEDULED");
    expect(scheduledRound.matches[0].homeTeam.sorareSlug).toBe("france");
  });

  it("preserves round order returned by the database", async () => {
    dbState.results = [
      [{ id: 1 }],
      [
        dbGame("g1", new Date("2026-06-11T16:00:00Z"),
          { slug: "morocco", name: "Morocco" }, { slug: "germany", name: "Germany" }),
        dbGame("g2", new Date("2026-07-19T22:00:00Z"),
          { slug: "spain", name: "Spain" }, { slug: "brazil", name: "Brazil" }),
      ],
    ];

    const res = await request(app).get("/api/world-cup/fixtures");
    expect(res.body.rounds[0].id).toBe("2026-06-11");
    expect(res.body.rounds[1].id).toBe("2026-07-19");
  });

  it("uses team crest from the database", async () => {
    dbState.results = [
      [{ id: 1 }],
      [
        dbGame("g1", new Date("2030-06-15T16:00:00Z"),
          { slug: "france", name: "France", crest: "https://sorare.com/france.png" },
          { slug: "argentina", name: "Argentina" }),
      ],
    ];

    const res = await request(app).get("/api/world-cup/fixtures");
    const match = res.body.rounds[0].matches[0];
    expect(match.homeTeam.crest).toBe("https://sorare.com/france.png");
    expect(match.awayTeam.crest).toBeNull();
  });

  it("groups multiple games on the same date into a single round", async () => {
    dbState.results = [
      [{ id: 1 }],
      [
        dbGame("g1", new Date("2030-06-15T14:00:00Z"),
          { slug: "france", name: "France" }, { slug: "argentina", name: "Argentina" }),
        dbGame("g2", new Date("2030-06-15T17:00:00Z"),
          { slug: "spain", name: "Spain" }, { slug: "brazil", name: "Brazil" }),
        dbGame("g3", new Date("2030-06-16T16:00:00Z"),
          { slug: "morocco", name: "Morocco" }, { slug: "germany", name: "Germany" }),
      ],
    ];

    const res = await request(app).get("/api/world-cup/fixtures");
    expect(res.status).toBe(200);
    expect(res.body.rounds).toHaveLength(2);
    expect(res.body.rounds[0].matches).toHaveLength(2);
    expect(res.body.rounds[1].matches).toHaveLength(1);
  });

  it("marks a game whose kickoff passed less than 150 minutes ago as IN_PLAY", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T16:45:00Z")); // 45 min after kickoff

    dbState.results = [
      [{ id: 1 }],
      [dbGame("g1", new Date("2026-06-15T16:00:00Z"),
        { slug: "france", name: "France" }, { slug: "argentina", name: "Argentina" })],
    ];

    const res = await request(app).get("/api/world-cup/fixtures");
    vi.useRealTimers();

    expect(res.status).toBe(200);
    expect(res.body.rounds[0].matches[0].status).toBe("IN_PLAY");
  });

  it("keeps a game as SCHEDULED before its kickoff time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T15:00:00Z")); // 1 hour before kickoff

    dbState.results = [
      [{ id: 1 }],
      [dbGame("g1", new Date("2026-06-15T16:00:00Z"),
        { slug: "france", name: "France" }, { slug: "argentina", name: "Argentina" })],
    ];

    const res = await request(app).get("/api/world-cup/fixtures");
    vi.useRealTimers();

    expect(res.body.rounds[0].matches[0].status).toBe("SCHEDULED");
  });
});

// ── GET /api/world-cup/standings ──────────────────────────────────────────────

describe("GET /api/world-cup/standings", () => {
  let savedKey: string | undefined;
  beforeEach(() => { savedKey = process.env.FOOTBALL_DATA_API_KEY; });
  afterEach(() => {
    if (savedKey !== undefined) process.env.FOOTBALL_DATA_API_KEY = savedKey;
    else delete process.env.FOOTBALL_DATA_API_KEY;
  });

  it("returns 500 when FOOTBALL_DATA_API_KEY is not set", async () => {
    delete process.env.FOOTBALL_DATA_API_KEY;
    const res = await request(app).get("/api/world-cup/standings");
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/FOOTBALL_DATA_API_KEY/);
  });

  it("returns 502 when football-data.org is unreachable", async () => {
    process.env.FOOTBALL_DATA_API_KEY = "test-key";
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("network failure"));
    const res = await request(app).get("/api/world-cup/standings");
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/unreachable/);
  });

  it("returns 502 when football-data.org returns a non-ok status", async () => {
    process.env.FOOTBALL_DATA_API_KEY = "test-key";
    vi.spyOn(global, "fetch").mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) } as Response);
    const res = await request(app).get("/api/world-cup/standings");
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/403/);
  });

  it("maps FD team IDs to Sorare slugs and returns group table", async () => {
    process.env.FOOTBALL_DATA_API_KEY = "test-key";
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        standings: [{
          stage: "GROUP_STAGE",
          type: "TOTAL",
          group: "GROUP_A",
          table: [
            { position: 1, team: { id: 773, name: "France", crest: "https://example.com/france.png" },
              playedGames: 1, won: 1, draw: 0, lost: 0, points: 3, goalsFor: 2, goalsAgainst: 0, goalDifference: 2 },
            { position: 2, team: { id: 762, name: "Argentina", crest: null },
              playedGames: 1, won: 0, draw: 0, lost: 1, points: 0, goalsFor: 0, goalsAgainst: 2, goalDifference: -2 },
          ],
        }],
      }),
    } as Response);

    const res = await request(app).get("/api/world-cup/standings");
    expect(res.status).toBe(200);
    expect(res.body.groups).toHaveLength(1);

    const group = res.body.groups[0];
    expect(group.group).toBe("GROUP_A");
    expect(group.label).toBe("Group A");
    expect(group.table).toHaveLength(2);
    expect(group.table[0]).toMatchObject({
      position: 1, sorareSlug: "france", name: "France",
      won: 1, points: 3, goalDifference: 2,
    });
    expect(group.table[1]).toMatchObject({ position: 2, sorareSlug: "argentina", points: 0 });
  });

  it("maps FD IDs for teams with divergent names (Ivory Coast → cote-d-ivoire)", async () => {
    process.env.FOOTBALL_DATA_API_KEY = "test-key";
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        standings: [{
          stage: "GROUP_STAGE", type: "TOTAL", group: "GROUP_B",
          table: [
            { position: 1, team: { id: 1935, name: "Ivory Coast", crest: null },
              playedGames: 0, won: 0, draw: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
            { position: 2, team: { id: 772, name: "South Korea", crest: null },
              playedGames: 0, won: 0, draw: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
          ],
        }],
      }),
    } as Response);

    const res = await request(app).get("/api/world-cup/standings");
    const table = res.body.groups[0].table;
    expect(table[0].sorareSlug).toBe("cote-d-ivoire");
    expect(table[1].sorareSlug).toBe("korea-republic");
  });

  it("sets sorareSlug to null for unknown FD team IDs", async () => {
    process.env.FOOTBALL_DATA_API_KEY = "test-key";
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        standings: [{
          stage: "GROUP_STAGE", type: "TOTAL", group: "GROUP_C",
          table: [
            { position: 1, team: { id: 99999, name: "Unknown FC", crest: null },
              playedGames: 0, won: 0, draw: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
          ],
        }],
      }),
    } as Response);

    const res = await request(app).get("/api/world-cup/standings");
    expect(res.body.groups[0].table[0].sorareSlug).toBeNull();
  });

  it("maps FD IDs for teams across multiple confederations", async () => {
    process.env.FOOTBALL_DATA_API_KEY = "test-key";
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        standings: [{
          stage: "GROUP_STAGE", type: "TOTAL", group: "GROUP_C",
          table: [
            { position: 1, team: { id: 8601, name: "Netherlands", crest: null },
              playedGames: 0, won: 0, draw: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
            { position: 2, team: { id: 764, name: "Brazil", crest: null },
              playedGames: 0, won: 0, draw: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
            { position: 3, team: { id: 828, name: "Canada", crest: null },
              playedGames: 0, won: 0, draw: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
            { position: 4, team: { id: 766, name: "Japan", crest: null },
              playedGames: 0, won: 0, draw: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
          ],
        }],
      }),
    } as Response);

    const res = await request(app).get("/api/world-cup/standings");
    const table = res.body.groups[0].table;
    expect(table[0].sorareSlug).toBe("netherlands");
    expect(table[1].sorareSlug).toBe("brazil");
    expect(table[2].sorareSlug).toBe("canada");
    expect(table[3].sorareSlug).toBe("japan");
  });

  it("maps FD IDs for CAF and AFC edge cases", async () => {
    process.env.FOOTBALL_DATA_API_KEY = "test-key";
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        standings: [{
          stage: "GROUP_STAGE", type: "TOTAL", group: "GROUP_D",
          table: [
            { position: 1, team: { id: 815, name: "Morocco", crest: null },
              playedGames: 0, won: 0, draw: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
            { position: 2, team: { id: 8062, name: "Iraq", crest: null },
              playedGames: 0, won: 0, draw: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
            { position: 3, team: { id: 783, name: "New Zealand", crest: null },
              playedGames: 0, won: 0, draw: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
            { position: 4, team: { id: 9460, name: "Curaçao", crest: null },
              playedGames: 0, won: 0, draw: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
          ],
        }],
      }),
    } as Response);

    const res = await request(app).get("/api/world-cup/standings");
    const table = res.body.groups[0].table;
    expect(table[0].sorareSlug).toBe("morocco");
    expect(table[1].sorareSlug).toBe("iraq");
    expect(table[2].sorareSlug).toBe("new-zealand");
    expect(table[3].sorareSlug).toBe("curacao");
  });

  it("only returns TOTAL type standings (excludes HOME/AWAY)", async () => {
    process.env.FOOTBALL_DATA_API_KEY = "test-key";
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        standings: [
          { stage: "GROUP_STAGE", type: "TOTAL",  group: "GROUP_A", table: [
            { position: 1, team: { id: 773, name: "France", crest: null },
              playedGames: 1, won: 1, draw: 0, lost: 0, points: 3, goalsFor: 1, goalsAgainst: 0, goalDifference: 1 },
          ]},
          { stage: "GROUP_STAGE", type: "HOME",   group: "GROUP_A", table: [] },
          { stage: "GROUP_STAGE", type: "AWAY",   group: "GROUP_A", table: [] },
        ],
      }),
    } as Response);

    const res = await request(app).get("/api/world-cup/standings");
    expect(res.body.groups).toHaveLength(1);
    expect(res.body.groups[0].table).toHaveLength(1);
  });
});

// ── POST /api/world-cup/sync ──────────────────────────────────────────────────

describe("POST /api/world-cup/sync", () => {
  // syncWorldCup() makes 3 db.select() calls before the team loop:
  //   [0] competition lookup, [1] stale-teams cleanup, [2] coach-subquery (not awaited)
  const syncDbSetup = () => { dbState.results = [[{ id: 42 }], [], []]; };

  it("syncs all 48 teams and returns stats", async () => {
    syncDbSetup();
    // Eliminate the 300ms per-team rate-limit delay so the test runs in milliseconds.
    vi.spyOn(global, "setTimeout").mockImplementation((fn: any) => { fn(); return 0 as any; });
    vi.mocked(db.insert).mockReturnValue(chainWith([{ id: 1 }]) as any);
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { football: { nationalTeam: { activePlayers: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        }}}},
      }),
    } as Response);

    const res = await request(app).post("/api/world-cup/sync");
    expect(res.status).toBe(200);
    expect(res.body.teams).toBe(48);
    expect(res.body.players).toBe(0);
    expect(typeof res.body.skipped).toBe("number");
  });

  it("skips Coach positions and counts only field players", async () => {
    syncDbSetup();
    vi.spyOn(global, "setTimeout").mockImplementation((fn: any) => { fn(); return 0 as any; });
    vi.mocked(db.insert).mockReturnValue(chainWith([{ id: 1 }]) as any);
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { football: { nationalTeam: { activePlayers: {
          nodes: [
            { slug: "coach-slug", displayName: "Some Coach", position: "Coach" },
            { slug: "player-slug", displayName: "Some Player", position: "Forward" },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        }}}},
      }),
    } as Response);

    const res = await request(app).post("/api/world-cup/sync");
    expect(res.status).toBe(200);
    expect(res.body.teams).toBe(48);
    expect(res.body.players).toBe(48); // 1 field player per team, coach excluded
  });
});

// ── GET /api/world-cup/squad/:sorareSlug ─────────────────────────────────────

describe("GET /api/world-cup/squad/:sorareSlug", () => {
  it("returns 404 when team is not in the database", async () => {
    dbState.results = [[]];
    const res = await request(app).get("/api/world-cup/squad/unknown-team");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("returns squad with synced Sorare stats from the database", async () => {
    dbState.results = [
      [{ id: 1, sorareSlug: "france", fdTeamName: "France" }],
      [{
        sorareSlug: "kylian-mbappe",
        name: "Kylian Mbappé",
        position: "Offence",
        addedManually: false,
        excludedFromSync: false,
        avgScore: 65.0,
        avg5Score: 67.0,
        avg40Score: 63.0,
        recentScores: [70, 60],
        gamesPlayedLast15: 12,
        currentClub: "Real Madrid",
        scoresUpdatedAt: new Date().toISOString(),
      }],
    ];

    const res = await request(app).get("/api/world-cup/squad/france");
    expect(res.status).toBe(200);
    expect(res.body.teamSlug).toBe("france");
    expect(res.body.teamName).toBe("France");
    const player = res.body.players[0];
    expect(player.sorareSlug).toBe("kylian-mbappe");
    expect(player.active).toBe(true);
    expect(player.sorare?.avgScore).toBe(65.0);
    expect(player.sorare?.recentScores).toEqual([70, 60]);
    expect(player.sorare?.currentClub).toBe("Real Madrid");
  });

  it("returns inactive players with active: false", async () => {
    dbState.results = [
      [{ id: 1, sorareSlug: "france", fdTeamName: "France" }],
      [{
        sorareSlug: "kylian-mbappe",
        name: "Kylian Mbappé",
        position: "Offence",
        addedManually: false,
        excludedFromSync: true,
        avgScore: null,
        recentScores: null,
        currentClub: null,
        scoresUpdatedAt: null,
      }],
    ];

    const res = await request(app).get("/api/world-cup/squad/france");
    expect(res.status).toBe(200);
    expect(res.body.players).toHaveLength(1);
    expect(res.body.players[0].active).toBe(false);
  });

  it("maps all Sorare position values to canonical display names", async () => {
    dbState.results = [
      [{ id: 1, sorareSlug: "france", fdTeamName: "France" }],
      [
        { sorareSlug: "gk", name: "Goalkeeper", position: "Goalkeeper", addedManually: false, avgScore: null, recentScores: null, currentClub: null, scoresUpdatedAt: null },
        { sorareSlug: "def", name: "Defender", position: "Defender", addedManually: false, avgScore: null, recentScores: null, currentClub: null, scoresUpdatedAt: null },
        { sorareSlug: "mid", name: "Midfielder", position: "Midfielder", addedManually: false, avgScore: null, recentScores: null, currentClub: null, scoresUpdatedAt: null },
        { sorareSlug: "fwd", name: "Forward", position: "Forward", addedManually: false, avgScore: null, recentScores: null, currentClub: null, scoresUpdatedAt: null },
      ],
    ];

    const res = await request(app).get("/api/world-cup/squad/france");
    expect(res.status).toBe(200);
    const bySlug = Object.fromEntries(res.body.players.map((p: any) => [p.sorareSlug, p.position]));
    expect(bySlug["gk"]).toBe("Goalkeeper");
    expect(bySlug["def"]).toBe("Defence");
    expect(bySlug["mid"]).toBe("Midfield");
    expect(bySlug["fwd"]).toBe("Offence");
  });

  it("returns null sorare for players whose scores have not been synced yet", async () => {
    dbState.results = [
      [{ id: 1, sorareSlug: "france", fdTeamName: "France" }],
      [{
        sorareSlug: "unknown-player",
        name: "Unknown Player",
        position: "Offence",
        addedManually: true,
        avgScore: null,
        recentScores: null,
        currentClub: null,
        scoresUpdatedAt: null,
      }],
    ];

    const res = await request(app).get("/api/world-cup/squad/france");
    expect(res.status).toBe(200);
    expect(res.body.players[0].sorare).toBeNull();
  });
});

// ── POST /api/world-cup/squad/:sorareSlug/players ────────────────────────────

describe("POST /api/world-cup/squad/:sorareSlug/players", () => {
  it("returns 400 when sorareSlug body field is missing", async () => {
    const res = await request(app)
      .post("/api/world-cup/squad/france/players")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it("returns 400 when sorareSlug is blank", async () => {
    const res = await request(app)
      .post("/api/world-cup/squad/france/players")
      .send({ sorareSlug: "   " });
    expect(res.status).toBe(400);
  });

  it("returns 404 when team is not in the database", async () => {
    dbState.results = [[]];
    const res = await request(app)
      .post("/api/world-cup/squad/unknown-team/players")
      .send({ sorareSlug: "some-player" });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/team not found/i);
  });

  it("returns 404 when player slug doesn't exist in Sorare", async () => {
    dbState.results = [[{ id: 1, sorareSlug: "france", fdTeamName: "France" }]];
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { football: { player: null } } }),
    } as Response);

    const res = await request(app)
      .post("/api/world-cup/squad/france/players")
      .send({ sorareSlug: "nonexistent-player" });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/player not found/i);
  });

  it("adds the player and returns their details", async () => {
    dbState.results = [[{ id: 1, sorareSlug: "france", fdTeamName: "France" }]];
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          football: {
            player: { slug: "kylian-mbappe", displayName: "Kylian Mbappé", position: "Forward" },
          },
        },
      }),
    } as Response);

    const res = await request(app)
      .post("/api/world-cup/squad/france/players")
      .send({ sorareSlug: "kylian-mbappe" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.player.slug).toBe("kylian-mbappe");
    expect(res.body.player.displayName).toBe("Kylian Mbappé");
  });
});

// ── DELETE /api/world-cup/squad/:sorareSlug/players/:playerSlug ───────────────

describe("DELETE /api/world-cup/squad/:sorareSlug/players/:playerSlug", () => {
  it("returns 404 when team does not exist", async () => {
    dbState.results = [[]];
    const res = await request(app).delete("/api/world-cup/squad/unknown/players/some-player");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/team not found/i);
  });

  it("returns 404 when player is not in the squad", async () => {
    dbState.results = [[{ id: 1, sorareSlug: "france", fdTeamName: "France" }]];
    // default db.update mock returns [] — no row matched
    const res = await request(app).delete("/api/world-cup/squad/france/players/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/player not found/i);
  });

  it("sets excludedFromSync and returns ok", async () => {
    dbState.results = [[{ id: 1, sorareSlug: "france", fdTeamName: "France" }]];
    vi.mocked(db.update).mockReturnValueOnce(chainWith([{ id: 42 }]) as any);
    const res = await request(app).delete("/api/world-cup/squad/france/players/kylian-mbappe");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ── POST /api/world-cup/squad/:sorareSlug/players/:playerSlug/restore ─────────

describe("POST /api/world-cup/squad/:sorareSlug/players/:playerSlug/restore", () => {
  it("returns 404 when team does not exist", async () => {
    dbState.results = [[]];
    const res = await request(app).post("/api/world-cup/squad/unknown/players/some-player/restore");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/team not found/i);
  });

  it("returns 404 when player is not in the squad", async () => {
    dbState.results = [[{ id: 1, sorareSlug: "france", fdTeamName: "France" }]];
    // default db.update mock returns [] — no row matched
    const res = await request(app).post("/api/world-cup/squad/france/players/nonexistent/restore");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/player not found/i);
  });

  it("clears excludedFromSync and returns ok", async () => {
    dbState.results = [[{ id: 1, sorareSlug: "france", fdTeamName: "France" }]];
    vi.mocked(db.update).mockReturnValueOnce(chainWith([{ id: 42 }]) as any);
    const res = await request(app).post("/api/world-cup/squad/france/players/kylian-mbappe/restore");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
