import app from "./app.js";
import { logger } from "./lib/logger.js";
import { syncAllPlayerScores } from "./lib/sorare-stats.js";
import { runMigrations } from "stripe-replit-sync";
import { runAppMigrations } from "@workspace/db/migrate";
import { getStripeSync } from "./stripeClient.js";
import cron from "node-cron";
import path from "path";
import { fileURLToPath } from "url";

// When bundled by esbuild, import.meta.url points to dist/index.mjs, so we
// derive the drizzle folder from the bundle's own location rather than relying
// on the path computed inside the bundled migrate.ts.
const __bundleDir = path.dirname(fileURLToPath(import.meta.url));
const appMigrationsFolder = path.join(__bundleDir, "../../../lib/db/drizzle");

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe initialization");
    return;
  }

  try {
    logger.info("Initializing Stripe schema...");
    await runMigrations({ databaseUrl, schema: "stripe" });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (domain) {
      await stripeSync.findOrCreateManagedWebhook(`https://${domain}/api/stripe/webhook`);
      logger.info("Stripe webhook configured");
    } else {
      logger.warn("REPLIT_DOMAINS not set — skipping webhook registration");
    }

    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe backfill complete"))
      .catch((err) => logger.error({ err }, "Stripe backfill failed"));
  } catch (err) {
    logger.error({ err }, "Stripe initialization failed — payments will be unavailable");
  }
}

logger.info("Running app DB migrations…");
await runAppMigrations(appMigrationsFolder);
logger.info("App DB migrations complete");

await initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  const runScoreSync = async () => {
    logger.info("Starting Sorare score sync");
    try {
      const result = await syncAllPlayerScores();
      logger.info(result, "Sorare score sync complete");
    } catch (err) {
      logger.error({ err }, "Sorare score sync failed");
    }
  };

  runScoreSync();
  cron.schedule("0 */6 * * *", runScoreSync);
});
