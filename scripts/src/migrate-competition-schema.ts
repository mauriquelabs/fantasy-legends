import { pool } from "@workspace/db";

// Migrates the old competition_teams (flat, denormalized) to:
//   teams         — team entity with sorare slug stored once
//   competitions  — competition entity with sport field (multi-sport ready)
//   competition_teams — clean join table (competition_code, season, team_id)
//
// Safe to re-run: uses CREATE TABLE IF NOT EXISTS + DROP IF EXISTS.
// All competition_teams rows are dropped; re-populate by running POST /api/world-cup/sync.

const client = await pool.connect();

try {
  await client.query("BEGIN");

  // 1. Drop the old denormalized join table (no data worth keeping — sync repopulates it)
  await client.query("DROP TABLE IF EXISTS competition_teams CASCADE");

  // 2. Create teams entity table
  await client.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id              SERIAL PRIMARY KEY,
      fd_team_id      INTEGER UNIQUE NOT NULL,
      fd_team_name    TEXT NOT NULL,
      sorare_slug     TEXT,
      match_confidence TEXT,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 3. Create competitions entity table
  await client.query(`
    CREATE TABLE IF NOT EXISTS competitions (
      code  TEXT PRIMARY KEY,
      name  TEXT NOT NULL,
      sport TEXT NOT NULL DEFAULT 'football'
    )
  `);

  // 4. Create normalized join table
  await client.query(`
    CREATE TABLE IF NOT EXISTS competition_teams (
      competition_code TEXT NOT NULL REFERENCES competitions(code),
      season           TEXT NOT NULL,
      team_id          INTEGER NOT NULL REFERENCES teams(id),
      PRIMARY KEY (competition_code, season, team_id)
    )
  `);

  await client.query("COMMIT");
  console.log("Migration complete.");
  console.log("  ✓ teams table created");
  console.log("  ✓ competitions table created");
  console.log("  ✓ competition_teams join table created");
  console.log("");
  console.log("Next: run POST /api/world-cup/sync to repopulate competition_teams.");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Migration failed — rolled back.", err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
