import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

// ── Mock supabaseAdmin ────────────────────────────────────────────────────────

const getUser = vi.hoisted(() => vi.fn());

vi.mock("../supabaseAdmin.js", () => ({
  supabaseAdmin: { auth: { getUser } },
}));

vi.mock("../lib/logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

// ── Test app ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.get("/protected", requireAuth, (req, res) => {
  res.json({ ok: true, user: (req as AuthenticatedRequest).user });
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

// ── requireAuth ───────────────────────────────────────────────────────────────

describe("requireAuth", () => {
  it("returns 401 when Authorization header is absent", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("returns 401 for non-Bearer schemes", async () => {
    const res = await request(app).get("/protected").set("Authorization", "Basic dXNlcjpwYXNz");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("returns 401 when Supabase reports a token error", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "jwt expired" } });
    const res = await request(app).get("/protected").set("Authorization", "Bearer bad-token");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid token");
  });

  it("returns 401 when the user record has no email", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "uid-1", email: null } }, error: null });
    const res = await request(app).get("/protected").set("Authorization", "Bearer tokenA");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid token");
  });

  it("calls next and sets req.user when token is valid", async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "alice@example.com" } },
      error: null,
    });
    const res = await request(app).get("/protected").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: "user-123", email: "alice@example.com" });
    expect(getUser).toHaveBeenCalledWith("valid-token");
  });

  it("passes the raw token string to getUser, stripping the Bearer prefix", async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { id: "uid-2", email: "bob@example.com" } },
      error: null,
    });
    await request(app).get("/protected").set("Authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig");
    expect(getUser).toHaveBeenCalledWith("eyJhbGciOiJIUzI1NiJ9.payload.sig");
  });

  it("accepts Bearer in any case (case-insensitive scheme)", async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { id: "uid-3", email: "carol@example.com" } },
      error: null,
    });
    const res = await request(app).get("/protected").set("Authorization", "BEARER some-token");
    expect(res.status).toBe(200);
    expect(getUser).toHaveBeenCalledWith("some-token");
  });

  it("returns 503 when the Supabase auth service throws", async () => {
    getUser.mockRejectedValueOnce(new Error("connection refused"));
    const res = await request(app).get("/protected").set("Authorization", "Bearer any-token");
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/unavailable/i);
  });
});
