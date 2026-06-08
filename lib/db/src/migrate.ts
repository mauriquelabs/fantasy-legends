import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = path.join(__dirname, "../../../.env");
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0 && !line.startsWith("#")) {
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      if (k && !process.env[k]) process.env[k] = v;
    }
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before running migrations.");
}

const migrationsFolder = path.join(__dirname, "../drizzle");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

console.log("Running database migrations…");

// Baseline detection: if __drizzle_migrations is empty but the schema already
// exists, selectively mark only the migrations whose changes are already present
// in the database. This prevents re-running CREATE TABLE / ADD COLUMN statements
// against an existing database while still allowing genuinely new migrations to run.
const client = await pool.connect();
try {
  // Ensure the drizzle schema exists (migrate() does this too, but we need
  // it before we can query the migrations table).
  await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const { rows: applied } = await client.query(
    "SELECT hash FROM drizzle.__drizzle_migrations"
  );

  if (applied.length === 0) {
    // Check whether the original schema tables already exist (i.e. this is a
    // pre-existing production database that predates file-based migrations).
    const { rows } = await client.query(`
      SELECT COUNT(*) AS n
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('players','teams','competitions','team_players','competition_teams','positions')
    `);
    const existingTableCount = parseInt(rows[0].n, 10);

    if (existingTableCount === 6) {
      console.log(
        "Existing schema detected; checking which migrations have already been applied…"
      );

      const columnExists = async (table: string, column: string) => {
        const { rows } = await client.query(
          `SELECT COUNT(*) AS n FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
          [table, column]
        );
        return parseInt(rows[0].n, 10) > 0;
      };

      const tableExists = async (table: string) => {
        const { rows } = await client.query(
          `SELECT COUNT(*) AS n FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = $1`,
          [table]
        );
        return parseInt(rows[0].n, 10) > 0;
      };

      // Per-migration fingerprints: one entry per migration file, in order.
      // IMPORTANT: add a new entry here whenever you run `db:generate`.
      // Each function returns true if that migration's changes are already in the DB.
      const fingerprints: Array<() => Promise<boolean>> = [
        async () => true,                                                    // 0000_busy_aqueduct      — base tables confirmed above
        async () => columnExists("players", "avg_score"),                    // 0001_player_scores
        async () => columnExists("players", "avg_5_score"),                  // 0002_stale_spyke
        async () => columnExists("players", "current_club"),                 // 0003_add_current_club
        async () => tableExists("leagues"),                                  // 0004_leagues
        async () => tableExists("picks"),                                    // 0005_careless_veda
        async () => tableExists("games"),                                    // 0006_lucky_tusk
        async () => columnExists("teams", "crest_url"),                      // 0007_normalize_games
        async () => columnExists("games", "home_team_id"),                   // 0008_games_team_id_fk
        async () => columnExists("competitions", "id"),                      // 0009_competition_surrogate_pk
      ];

      const pendingMigrations = readMigrationFiles({ migrationsFolder });

      if (fingerprints.length !== pendingMigrations.length) {
        throw new Error(
          `Migration fingerprint mismatch: ${fingerprints.length} fingerprint(s) defined but ${pendingMigrations.length} migration file(s) found. ` +
          `Add a fingerprint entry to migrate.ts for each new migration.`
        );
      }

      for (let i = 0; i < pendingMigrations.length; i++) {
        const m = pendingMigrations[i];
        const check = fingerprints[i];

        if (check && (await check())) {
          await client.query(
            "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
            [m.hash, m.folderMillis]
          );
          console.log(`  ✓ Migration ${String(i).padStart(4, "0")} already applied — marked as baseline`);
        } else {
          console.log(`  → Migration ${String(i).padStart(4, "0")} not yet applied — will run now`);
          // Migrations are sequential: once one is missing, all following ones are too.
          break;
        }
      }
    }
  }
} finally {
  client.release();
}

await migrate(db, { migrationsFolder });
console.log("Migrations complete.");

await pool.end();
