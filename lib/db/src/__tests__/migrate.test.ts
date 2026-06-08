import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbRoot = path.join(__dirname, "../..");

describe("migration fingerprints", () => {
  it("has one fingerprint per migration file", () => {
    const drizzleDir = path.join(dbRoot, "drizzle");
    const migrationCount = readdirSync(drizzleDir).filter(f => f.endsWith(".sql")).length;

    const migrateSrc = readFileSync(path.join(dbRoot, "src/migrate.ts"), "utf8");
    // Each fingerprint entry has a trailing comment like `// 0000_tag`
    const fingerprintCount = (migrateSrc.match(/\/\/ \d{4}_/g) ?? []).length;

    expect(fingerprintCount).toBe(migrationCount);
  });
});
