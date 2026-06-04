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

const migrationsFolder = path.join(__dirname, "../drizzle");

export async function runAppMigrations() {
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

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  const client = await pool.connect();
  try {
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
      const { rows } = await client.query(`
        SELECT COUNT(*) AS n
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('players','teams','competitions','team_players','competition_teams','positions')
      `);
      const existingTableCount = parseInt(rows[0].n, 10);

      if (existingTableCount === 6) {
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
  await pool.end();
}

// Run directly when invoked as a script: node --import tsx/esm src/migrate.ts
if (process.argv[1] === __filename) {
  console.log("Running database migrations…");
  await runAppMigrations();
  console.log("Migrations complete.");
}
