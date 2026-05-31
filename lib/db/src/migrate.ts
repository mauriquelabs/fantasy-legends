import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before running migrations.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsFolder = path.join(__dirname, "../drizzle");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

console.log("Running database migrations…");

// Baseline detection: if __drizzle_migrations is empty but the schema already
// exists, mark all migrations as applied so Drizzle does not try to re-run
// CREATE TABLE statements against an existing database.
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
    // Check whether the schema tables already exist (i.e. this is a
    // pre-existing production database that predates file-based migrations).
    const { rows } = await client.query(`
      SELECT COUNT(*) AS n
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('players','teams','competitions','team_players','competition_teams','positions')
    `);
    const existingTableCount = parseInt(rows[0].n, 10);

    if (existingTableCount === 6) {
      // All schema tables exist — baseline every migration so Drizzle skips them.
      console.log(
        "Existing schema detected; marking all migrations as already applied."
      );
      const pendingMigrations = readMigrationFiles({ migrationsFolder });
      for (const m of pendingMigrations) {
        await client.query(
          "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
          [m.hash, m.folderMillis]
        );
      }
    }
  }
} finally {
  client.release();
}

await migrate(db, { migrationsFolder });
console.log("Migrations complete.");

await pool.end();
