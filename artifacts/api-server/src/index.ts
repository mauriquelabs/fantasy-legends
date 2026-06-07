import app from "./app";
import { logger } from "./lib/logger";
import { syncAllPlayerScores } from "./lib/sorare-stats";
import { syncWorldCup } from "./routes/world-cup";
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

  const runWCSync = async () => {
    logger.info("Starting World Cup sync");
    try {
      const result = await syncWorldCup();
      logger.info(result, "World Cup sync complete");
    } catch (err) {
      logger.error({ err }, "World Cup sync failed");
    }
  };

  // Run World Cup sync once at startup (non-blocking)
  runWCSync();

  // Run once at startup, then every 6 hours (at 0, 6, 12, 18:00 UTC)
  runScoreSync();
  cron.schedule("0 */6 * * *", runScoreSync);
});
