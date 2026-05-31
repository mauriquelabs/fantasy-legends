import { db, players } from "@workspace/db";
import { isNotNull, sql } from "drizzle-orm";

const SORARE_URL = "https://api.sorare.com/graphql";
const SORARE_AGENT = "Sorare Companion App";

export interface SorarePlayerStats {
  slug: string;
  displayName: string;
  position: string;
  avgScore: number | null;
  avg5Score: number | null;
  avg40Score: number | null;
  recentScores: number[];
  gamesPlayedLast15: number;
  currentClub: string | null;
}

export async function fetchLiveStats(sorareSlugs: string[]): Promise<Map<string, SorarePlayerStats>> {
  const result = new Map<string, SorarePlayerStats>();
  if (!sorareSlugs.length) return result;

  const playerFields = `
    slug displayName position
    averageScore(type: LAST_FIFTEEN_SO5_AVERAGE_SCORE)
    avg5Score: averageScore(type: LAST_FIVE_SO5_AVERAGE_SCORE)
    avg40Score: averageScore(type: LAST_FORTY_SO5_AVERAGE_SCORE)
    so5Scores(last: 5) { score }
    last15Scores: so5Scores(last: 15) { score }
    activeClub { name }
  `;

  const BATCH = 15;
  for (let i = 0; i < sorareSlugs.length; i += BATCH) {
    const batch = sorareSlugs.slice(i, i + BATCH);
    const batchNum = i / BATCH + 1;
    const aliases = batch
      .map((slug, j) => `p${j}: player(slug: ${JSON.stringify(slug)}) { ${playerFields} }`)
      .join("\n");

    try {
      const res = await fetch(SORARE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
        body: JSON.stringify({ query: `query LiveStats { football { ${aliases} } }` }),
      });
      const json: any = await res.json();

      if (json?.errors?.length) {
        console.warn(`[sorare-stats] batch ${batchNum} GraphQL errors:`, JSON.stringify(json.errors));
      }

      const football = json?.data?.football;
      if (!football) {
        console.warn(`[sorare-stats] batch ${batchNum} returned no football data (HTTP ${res.status}). Slugs:`, batch);
        continue;
      }

      for (let j = 0; j < batch.length; j++) {
        const p = football[`p${j}`];
        if (!p?.slug) {
          console.warn(`[sorare-stats] batch ${batchNum}: no data for slug "${batch[j]}" (Sorare returned null)`);
          continue;
        }
        if (p.slug !== batch[j]) {
          console.warn(`[sorare-stats] batch ${batchNum}: slug mismatch — queried "${batch[j]}", got "${p.slug}"`);
        }
        const last15: number[] = (p.last15Scores ?? []).map((s: any) => s.score as number);
        result.set(batch[j], {
          slug: p.slug,
          displayName: p.displayName,
          position: p.position ?? "",
          avgScore: p.averageScore ?? null,
          avg5Score: p.avg5Score ?? null,
          avg40Score: p.avg40Score ?? null,
          recentScores: (p.so5Scores ?? []).map((s: any) => s.score as number),
          gamesPlayedLast15: last15.filter((score) => score > 0).length,
          currentClub: p.activeClub?.name ?? null,
        });
      }
    } catch (err) {
      console.warn(`[sorare-stats] batch ${batchNum} fetch failed:`, err);
    }
  }
  return result;
}

export async function syncAllPlayerScores(): Promise<{ updated: number; errors: number }> {
  const rows = await db
    .select({ sorareSlug: players.sorareSlug })
    .from(players)
    .where(isNotNull(players.sorareSlug));

  const slugs = rows.map(r => r.sorareSlug!);
  console.log(`[sorare-stats] syncing ${slugs.length} players…`);
  const stats = await fetchLiveStats(slugs);

  const missing = slugs.filter(s => !stats.has(s));
  console.log(`[sorare-stats] Sorare returned data for ${stats.size}/${slugs.length} players`);
  if (missing.length) {
    console.warn(`[sorare-stats] ${missing.length} slugs with no Sorare data:`, missing);
  }

  let updated = 0;
  let errors = 0;
  const now = new Date();

  const BATCH = 50;
  for (let i = 0; i < slugs.length; i += BATCH) {
    const batch = slugs.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (slug) => {
        const s = stats.get(slug);
        if (!s) return; // Sorare had no data for this slug — preserve existing scores
        try {
          await db
            .update(players)
            .set({
              avgScore: s.avgScore,
              avg5Score: s.avg5Score,
              avg40Score: s.avg40Score,
              recentScores: s.recentScores,
              gamesPlayedLast15: s.gamesPlayedLast15,
              currentClub: s.currentClub,
              scoresUpdatedAt: now,
            })
            .where(sql`${players.sorareSlug} = ${slug}`);
          updated++;
        } catch (err) {
          console.warn(`[sorare-stats] failed to update scores for ${slug}:`, err);
          errors++;
        }
      })
    );
  }

  return { updated, errors };
}
