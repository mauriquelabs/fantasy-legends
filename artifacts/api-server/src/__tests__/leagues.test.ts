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

// Drizzle fluent-query chain — hoisted so the vi.mock factory can reference it.
const chain = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  innerJoin: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  onConflictDoNothing: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: chain,
  leagues: { id: "leagues.id", code: "leagues.code" },
  leagueMembers: { leagueId: "lm.leagueId", userId: "lm.userId" },
  sql: vi.fn().mockReturnValue("sql_expr"),
  eq: vi.fn((a, b) => `${String(a)}=${String(b)}`),
}));

import leaguesRouter from "../routes/leagues.js";

// ── Test app ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use("/api", leaguesRouter);

// Helper: seed getUser so requireAuth passes
function authedAs(id = "user-1", email = "test@example.com") {
  getUser.mockResolvedValueOnce({ data: { user: { id, email } }, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  chain.select.mockReturnValue(chain);
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.values.mockReturnValue(chain);
  chain.onConflictDoNothing.mockResolvedValue(undefined);
});

// ── GET /api/leagues/:code ─────────────────────────────────────────────────────

describe("GET /api/leagues/:code", () => {
  it("returns 404 when league not found", async () => {
    chain.limit.mockResolvedValueOnce([]);
    const res = await request(app).get("/api/leagues/unknown");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("League not found");
  });

  it("returns league data when found", async () => {
    const league = {
      id: 1,
      code: "myteam",
      name: "My Team",
      squadSize: 5,
      draftAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      memberCount: 3,
    };
    chain.limit.mockResolvedValueOnce([league]);
    const res = await request(app).get("/api/leagues/myteam");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ code: "myteam", name: "My Team", memberCount: 3 });
  });
});

// ── POST /api/leagues/:code/join ──────────────────────────────────────────────

describe("POST /api/leagues/:code/join", () => {
  it("returns 401 without a Bearer token", async () => {
    const res = await request(app).post("/api/leagues/test/join");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the league does not exist", async () => {
    authedAs();
    chain.limit.mockResolvedValueOnce([]); // league not found
    const res = await request(app)
      .post("/api/leagues/ghost/join")
      .set("Authorization", "Bearer tok");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("League not found");
  });

  it("returns 200 and joined:true for a new member", async () => {
    authedAs("user-42");
    chain.limit.mockResolvedValueOnce([{ id: 7 }]); // league found
    const res = await request(app)
      .post("/api/leagues/aticco/join")
      .set("Authorization", "Bearer valid");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ joined: true });
    expect(chain.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("is idempotent — returns 200 even when already a member", async () => {
    authedAs("user-42");
    chain.limit.mockResolvedValueOnce([{ id: 7 }]); // league found
    // onConflictDoNothing handles the duplicate silently — no error thrown
    const res = await request(app)
      .post("/api/leagues/aticco/join")
      .set("Authorization", "Bearer valid");
    expect(res.status).toBe(200);
    expect(res.body.joined).toBe(true);
  });
});

// ── POST /api/leagues — create ────────────────────────────────────────────────

describe("POST /api/leagues", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).post("/api/leagues").send({ name: "X", code: "x" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when code has invalid characters", async () => {
    authedAs();
    const res = await request(app)
      .post("/api/leagues")
      .set("Authorization", "Bearer tok")
      .send({ name: "Bad Code", code: "bad code!" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/code must be/i);
  });

  it("returns 400 when code is too short", async () => {
    authedAs();
    const res = await request(app)
      .post("/api/leagues")
      .set("Authorization", "Bearer tok")
      .send({ name: "Short", code: "ab" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is missing", async () => {
    authedAs();
    const res = await request(app)
      .post("/api/leagues")
      .set("Authorization", "Bearer tok")
      .send({ code: "validcode" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name and code/i);
  });
});
