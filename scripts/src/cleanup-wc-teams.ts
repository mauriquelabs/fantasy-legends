import { db, teams, competitionTeams, competitions } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Removes stale WC competition memberships only.
 * Does NOT delete global teams/players — other competitions may still use them.
 * Keep in sync with artifacts/api-server/src/data/competition-rosters.ts
 */
const WC_SLUGS = [
  "france", "spain", "england", "germany", "portugal", "netherlands",
  "belgium", "croatia", "switzerland", "austria", "turkey", "scotland",
  "norway", "sweden", "czech-republic", "bosnia-herzegovina",
  "argentina", "brazil", "colombia", "uruguay", "ecuador", "paraguay",
  "united-states", "mexico", "canada", "panama", "haiti", "curacao",
  "morocco", "senegal", "egypt", "cote-d-ivoire", "south-africa",
  "tunisia", "ghana", "algeria", "congo-dr",
  "japan", "korea-republic", "iran", "australia", "saudi-arabia",
  "iraq", "jordan", "uzbekistan",
  "new-zealand",
  "qatar",
  "cape-verde-islands",
];

const [wc] = await db
  .select({ id: competitions.id, season: competitions.season })
  .from(competitions)
  .where(eq(competitions.code, "WC"))
  .limit(1);

if (!wc) {
  console.log("WC competition not found — nothing to clean.");
  process.exit(0);
}

const season = wc.season ?? "2026";

const memberships = await db
  .select({
    teamId: competitionTeams.teamId,
    slug: teams.sorareSlug,
    name: teams.fdTeamName,
  })
  .from(competitionTeams)
  .innerJoin(teams, eq(teams.id, competitionTeams.teamId))
  .where(
    and(
      eq(competitionTeams.competitionId, wc.id),
      eq(competitionTeams.season, season),
    ),
  );

const stale = memberships.filter((m) => !m.slug || !WC_SLUGS.includes(m.slug));

if (stale.length === 0) {
  console.log("No stale WC memberships found — database is clean.");
  process.exit(0);
}

console.log(`Found ${stale.length} stale WC competition memberships:`);
stale.forEach((t) =>
  console.log(`  - [${t.teamId}] slug="${t.slug}" name="${t.name}"`),
);

const staleIds = stale.map((t) => t.teamId);
const deletedCt = await db
  .delete(competitionTeams)
  .where(
    and(
      eq(competitionTeams.competitionId, wc.id),
      eq(competitionTeams.season, season),
      inArray(competitionTeams.teamId, staleIds),
    ),
  )
  .returning({ teamId: competitionTeams.teamId });

console.log(`\nDeleted ${deletedCt.length} competition_teams rows for WC.`);
console.log("Teams/players left intact for other competitions.");
console.log("\nCleanup complete.");
process.exit(0);
