import { db, teams, teamPlayers, competitionTeams, players } from "@workspace/db";
import { and, eq, notInArray, isNull, inArray, sql } from "drizzle-orm";

// Canonical WC 2026 sorare slugs — must stay in sync with world-cup.ts WC_TEAMS
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

// 1. Find all non-canonical team IDs (wrong slug or null slug)
const allTeams = await db.select({ id: teams.id, slug: teams.sorareSlug, name: teams.fdTeamName }).from(teams);
const staleTeamIds = allTeams
  .filter(t => !t.slug || !WC_SLUGS.includes(t.slug))
  .map(t => t.id);

if (staleTeamIds.length === 0) {
  console.log("No stale teams found — database is clean.");
  process.exit(0);
}

console.log(`Found ${staleTeamIds.length} stale team entries:`);
allTeams
  .filter(t => !t.slug || !WC_SLUGS.includes(t.slug))
  .forEach(t => console.log(`  - [${t.id}] slug="${t.slug}" name="${t.name}"`));

// 2. Remove stale competition_teams entries
const deletedCt = await db
  .delete(competitionTeams)
  .where(inArray(competitionTeams.teamId, staleTeamIds))
  .returning({ teamId: competitionTeams.teamId });
console.log(`\nDeleted ${deletedCt.length} competition_teams rows.`);

// 3. Remove stale team_players entries
const deletedTp = await db
  .delete(teamPlayers)
  .where(inArray(teamPlayers.teamId, staleTeamIds))
  .returning({ sorareSlug: teamPlayers.sorareSlug });
console.log(`Deleted ${deletedTp.length} team_players rows.`);

// 4. Remove orphaned players (no remaining team_players entry)
const orphanedPlayers = await db
  .select({ sorareSlug: players.sorareSlug })
  .from(players)
  .where(
    sql`${players.sorareSlug} NOT IN (SELECT sorare_slug FROM team_players)`
  );
if (orphanedPlayers.length > 0) {
  const orphanSlugs = orphanedPlayers.map(p => p.sorareSlug).filter((s): s is string => s !== null);
  await db.delete(players).where(inArray(players.sorareSlug, orphanSlugs));
  console.log(`Deleted ${orphanedPlayers.length} orphaned player rows.`);
} else {
  console.log("No orphaned players found.");
}

// 5. Remove stale team rows
const deletedTeams = await db
  .delete(teams)
  .where(inArray(teams.id, staleTeamIds))
  .returning({ slug: teams.sorareSlug, name: teams.fdTeamName });
console.log(`Deleted ${deletedTeams.length} team rows.`);

console.log("\nCleanup complete.");
process.exit(0);
