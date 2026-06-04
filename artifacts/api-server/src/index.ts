import app from "./app.js";
import { logger } from "./lib/logger.js";
import { syncAllPlayerScores } from "./lib/sorare-stats.js";
import { runMigrations } from "stripe-replit-sync";
import { runAppMigrations } from "@workspace/db/migrate";
import { getStripeSync } from "./stripeClient.js";
import cron from "node-cron";

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
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    logger.info("Stripe webhook configured");

    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe backfill complete"))
      .catch((err) => logger.error({ err }, "Stripe backfill failed"));
  } catch (err) {
    logger.error({ err }, "Stripe initialization failed — payments will be unavailable");
  }
}

logger.info("Running app DB migrations…");
await runAppMigrations();
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
