import { db, positions } from "@workspace/db";
import { eq } from "drizzle-orm";

// football-data.org v4 returns both broad and granular position strings.
// This table maps every raw value to one of our four canonical groups.
const FOOTBALL_POSITIONS = [
  // Broad (returned for some players)
  { rawName: "Goalkeeper",         canonicalName: "Goalkeeper", sortOrder: 1 },
  { rawName: "Defence",            canonicalName: "Defence",    sortOrder: 2 },
  { rawName: "Midfield",           canonicalName: "Midfield",   sortOrder: 3 },
  { rawName: "Offence",            canonicalName: "Offence",    sortOrder: 4 },
  // Granular (returned for most players)
  { rawName: "Centre-Back",        canonicalName: "Defence",    sortOrder: 2 },
  { rawName: "Right-Back",         canonicalName: "Defence",    sortOrder: 2 },
  { rawName: "Left-Back",          canonicalName: "Defence",    sortOrder: 2 },
  { rawName: "Defensive Midfield", canonicalName: "Midfield",   sortOrder: 3 },
  { rawName: "Central Midfield",   canonicalName: "Midfield",   sortOrder: 3 },
  { rawName: "Attacking Midfield", canonicalName: "Midfield",   sortOrder: 3 },
  { rawName: "Right Midfield",     canonicalName: "Midfield",   sortOrder: 3 },
  { rawName: "Left Midfield",      canonicalName: "Midfield",   sortOrder: 3 },
  { rawName: "Right Winger",       canonicalName: "Offence",    sortOrder: 4 },
  { rawName: "Left Winger",        canonicalName: "Offence",    sortOrder: 4 },
  { rawName: "Centre-Forward",     canonicalName: "Offence",    sortOrder: 4 },
  { rawName: "Secondary Striker",  canonicalName: "Offence",    sortOrder: 4 },
].map(p => ({ sport: "football", ...p }));

await db.delete(positions).where(eq(positions.sport, "football"));
await db.insert(positions).values(FOOTBALL_POSITIONS);

console.log(`Seeded ${FOOTBALL_POSITIONS.length} football positions.`);
process.exit(0);
