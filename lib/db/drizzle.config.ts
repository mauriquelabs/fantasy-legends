import { defineConfig } from "drizzle-kit";
import path from "path";
import { readFileSync, existsSync } from "fs";

// Auto-load workspace root .env when DATABASE_URL isn't already in the environment
const envFile = path.join(__dirname, "../../.env");
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
  throw new Error("DATABASE_URL not set — add it to the root .env file");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./drizzle"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
