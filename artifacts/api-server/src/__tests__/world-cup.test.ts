import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

// ── Mock db ───────────────────────────────────────────────────────────────────

const dbState = vi.hoisted(() => ({ results: [] as any[], call: 0 }));

vi.mock("@workspace/db", () => {
  function chain(val: any): any {
    const node: any = { then: (ok: any, fail?: any) => Promise.resolve(val).then(ok, fail) };
    for (const m of ["from", "where", "leftJoin", "values", "set",
                     "onConflictDoNothing", "onConflictDoUpdate", "returning"]) {
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
  return { db, players: {}, teams: {}, competitions: {}, competitionTeams: {}, teamPlayers: {} };
});

vi.mock("../lib/server-cache", () => ({
  fromCache: vi.fn(() => null),
  toCache: vi.fn(),
  clearByPrefix: vi.fn(),
}));

import worldCupRouter, { sorareSlugFromFdName } from "../routes/world-cup.js";

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

// ── sorareSlugFromFdName ──────────────────────────────────────────────────────

describe("sorareSlugFromFdName", () => {
  it("maps FD_NAME_OVERRIDES entries", () => {
    expect(sorareSlugFromFdName("Korea Republic")).toBe("korea-republic");
    expect(sorareSlugFromFdName("IR Iran")).toBe("iran");
    expect(sorareSlugFromFdName("USA")).toBe("united-states");
    expect(sorareSlugFromFdName("Ivory Coast")).toBe("cote-d-ivoire");
  });

  it("falls back to WC_TEAMS name lookup (case-insensitive)", () => {
    expect(sorareSlugFromFdName("France")).toBe("france");
    expect(sorareSlugFromFdName("FRANCE")).toBe("france");
    expect(sorareSlugFromFdName("Argentina")).toBe("argentina");
    expect(sorareSlugFromFdName("United States")).toBe("united-states");
  });

  it("returns undefined for names not in the list", () => {
    expect(sorareSlugFromFdName("Wakanda")).toBeUndefined();
    expect(sorareSlugFromFdName("")).toBeUndefined();
  });
});

// ── GET /api/world-cup/teams ──────────────────────────────────────────────────

describe("GET /api/world-cup/teams", () => {
  it("returns all 48 WC teams", async () => {
    const res = await request(app).get("/api/world-cup/teams");
    expect(res.status).toBe(200);
    expect(res.body.teams).toHaveLength(48);
    expect(res.body.teams[0]).toMatchObject({ slug: expect.any(String), name: expect.any(String) });
  });

  it("includes expected teams from different confederations", async () => {
    const res = await request(app).get("/api/world-cup/teams");
    const slugs: string[] = res.body.teams.map((t: any) => t.slug);
    expect(slugs).toContain("france");
    expect(slugs).toContain("argentina");
    expect(slugs).toContain("morocco");
    expect(slugs).toContain("japan");
    expect(slugs).toContain("united-states");
  });
});

// ── GET /api/world-cup/fixtures ───────────────────────────────────────────────

describe("GET /api/world-cup/fixtures", () => {
  const GROUP_MATCH = {
    id: 1,
    utcDate: "2026-06-11T16:00:00Z",
    status: "SCHEDULED",
    stage: "GROUP_STAGE",
    matchday: 1,
    group: "GROUP_A",
    homeTeam: { id: 10, name: "Morocco", crest: "https://example.com/morocco.png" },
    awayTeam: { id: 11, name: "Argentina", crest: "https://example.com/argentina.png" },
    score: { fullTime: { home: null, away: null } },
  };

  const FINAL_MATCH = {
    id: 2,
    utcDate: "2026-07-19T22:00:00Z",
    status: "SCHEDULED",
    stage: "FINAL",
    matchday: null,
    group: null,
    homeTeam: { id: 12, name: "Spain", crest: "https://example.com/spain.png" },
    awayTeam: { id: 13, name: "France", crest: "https://example.com/france.png" },
    score: { fullTime: { home: null, away: null } },
  };

  let savedKey: string | undefined;
  beforeEach(() => { savedKey = process.env.FOOTBALL_DATA_API_KEY; });
  afterEach(() => {
    if (savedKey !== undefined) process.env.FOOTBALL_DATA_API_KEY = savedKey;
    else delete process.env.FOOTBALL_DATA_API_KEY;
  });

  it("returns 500 when FOOTBALL_DATA_API_KEY is not set", async () => {
    delete process.env.FOOTBALL_DATA_API_KEY;
    const res = await request(app).get("/api/world-cup/fixtures");
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/FOOTBALL_DATA_API_KEY/);
  });

  it("returns 502 when football-data.org is unreachable", async () => {
    process.env.FOOTBALL_DATA_API_KEY = "test-key";
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("network failure"));
    const res = await request(app).get("/api/world-cup/fixtures");
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/unreachable/);
  });

  it("groups GROUP_STAGE matches as Matchday N", async () => {
    process.env.FOOTBALL_DATA_API_KEY = "test-key";
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ matches: [GROUP_MATCH] }),
    } as Response);

    const res = await request(app).get("/api/world-cup/fixtures");
    expect(res.status).toBe(200);
    const round = res.body.rounds[0];
    expect(round.id).toBe("GROUP_STAGE_1");
    expect(round.label).toBe("Matchday 1");
    expect(round.matches[0].group).toBe("Group A");
  });

  it("labels knockout rounds with human-readable names", async () => {
    process.env.FOOTBALL_DATA_API_KEY = "test-key";
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ matches: [FINAL_MATCH] }),
    } as Response);

    const res = await request(app).get("/api/world-cup/fixtures");
    const round = res.body.rounds[0];
    expect(round.id).toBe("FINAL");
    expect(round.label).toBe("Final");
  });

  it("attaches sorareSlug to teams using FD name mapping", async () => {
    process.env.FOOTBALL_DATA_API_KEY = "test-key";
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ matches: [GROUP_MATCH] }),
    } as Response);

    const res = await request(app).get("/api/world-cup/fixtures");
    const match = res.body.rounds[0].matches[0];
    expect(match.homeTeam.sorareSlug).toBe("morocco");
    expect(match.awayTeam.sorareSlug).toBe("argentina");
  });

  it("sorts rounds chronologically", async () => {
    process.env.FOOTBALL_DATA_API_KEY = "test-key";
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ matches: [FINAL_MATCH, GROUP_MATCH] }),
    } as Response);

    const res = await request(app).get("/api/world-cup/fixtures");
    expect(res.body.rounds).toHaveLength(2);
    expect(res.body.rounds[0].startDate).toBe(GROUP_MATCH.utcDate);
    expect(res.body.rounds[1].startDate).toBe(FINAL_MATCH.utcDate);
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

  it("returns squad with live Sorare stats merged", async () => {
    dbState.results = [
      [{ id: 1, sorareSlug: "france", fdTeamName: "France" }],
      [{ sorareSlug: "kylian-mbappe", name: "Kylian Mbappé", position: "Offence", addedManually: false }],
    ];
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          football: {
            p0: {
              slug: "kylian-mbappe",
              displayName: "Kylian Mbappé",
              position: "Forward",
              averageScore: 65.0,
              so5Scores: [{ score: 70 }, { score: 60 }],
              activeClub: { name: "Real Madrid" },
            },
          },
        },
      }),
    } as Response);

    const res = await request(app).get("/api/world-cup/squad/france");
    expect(res.status).toBe(200);
    expect(res.body.teamSlug).toBe("france");
    expect(res.body.teamName).toBe("France");
    const player = res.body.players[0];
    expect(player.sorareSlug).toBe("kylian-mbappe");
    expect(player.sorare?.avgScore).toBe(65.0);
    expect(player.sorare?.recentScores).toEqual([70, 60]);
    expect(player.sorare?.currentClub).toBe("Real Madrid");
  });

  it("returns players with null sorare when Sorare has no data for them", async () => {
    dbState.results = [
      [{ id: 1, sorareSlug: "france", fdTeamName: "France" }],
      [{ sorareSlug: "unknown-player", name: "Unknown Player", position: "Offence", addedManually: true }],
    ];
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { football: { p0: null } } }),
    } as Response);

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

  it("sets excludedFromSync and returns ok", async () => {
    dbState.results = [[{ id: 1, sorareSlug: "france", fdTeamName: "France" }]];
    const res = await request(app).delete("/api/world-cup/squad/france/players/kylian-mbappe");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
