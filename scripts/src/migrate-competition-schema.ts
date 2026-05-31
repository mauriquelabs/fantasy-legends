import { pool } from "@workspace/db";

// Migrates to the current schema:
//   players        — adds hidden column (safe if already exists)
//   teams          — team entity keyed by sorare_slug (fd_team_id now optional)
//   competitions   — competition entity with sport field
//   competition_teams — join table (competition_code, season, team_id)
//   team_players   — per-team player roster with add/exclude flags
//
// Destructive: drops and recreates teams, competition_teams, and team_players.
// Safe to re-run: old data is repopulated by POST /api/world-cup/sync.

const client = await pool.connect();

try {
  await client.query("BEGIN");

  // 1. Drop dependent tables so we can recreate them with the correct schema.
  //    Order matters: team_players and competition_teams reference teams.
  await client.query("DROP TABLE IF EXISTS team_players CASCADE");
  await client.query("DROP TABLE IF EXISTS competition_teams CASCADE");
  await client.query("DROP TABLE IF EXISTS teams CASCADE");
  await client.query("DROP TABLE IF EXISTS competitions CASCADE");

  // 2. Add hidden column to players if it doesn't exist yet (safe ALTER).
  await client.query(`
    ALTER TABLE players ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false
  `);

  // 3. Create teams — sorare_slug is now the primary business key; fd_team_id is optional.
  await client.query(`
    CREATE TABLE teams (
      id               SERIAL PRIMARY KEY,
      fd_team_id       INTEGER UNIQUE,
      fd_team_name     TEXT,
      sorare_slug      TEXT UNIQUE,
      match_confidence TEXT,
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 4. Create competitions entity table.
  await client.query(`
    CREATE TABLE competitions (
      code  TEXT PRIMARY KEY,
      name  TEXT NOT NULL,
      sport TEXT NOT NULL DEFAULT 'football'
    )
  `);

  // 5. Create normalized competition–team join table.
  await client.query(`
    CREATE TABLE competition_teams (
      competition_code TEXT NOT NULL REFERENCES competitions(code),
      season           TEXT NOT NULL,
      team_id          INTEGER NOT NULL REFERENCES teams(id),
      PRIMARY KEY (competition_code, season, team_id)
    )
  `);

  // 6. Create per-team player roster table.
  await client.query(`
    CREATE TABLE team_players (
      team_id            INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      sorare_slug        TEXT NOT NULL,
      added_manually     BOOLEAN NOT NULL DEFAULT false,
      excluded_from_sync BOOLEAN NOT NULL DEFAULT false,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (team_id, sorare_slug)
    )
  `);

  await client.query("COMMIT");
  console.log("Migration complete.");
  console.log("  ✓ players.hidden column added (or already existed)");
  console.log("  ✓ teams table created (sorare_slug key, fd_team_id optional)");
  console.log("  ✓ competitions table created");
  console.log("  ✓ competition_teams join table created");
  console.log("  ✓ team_players roster table created");
  console.log("");
  console.log("Next: run POST /api/world-cup/sync to repopulate all tables.");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Migration failed — rolled back.", err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
