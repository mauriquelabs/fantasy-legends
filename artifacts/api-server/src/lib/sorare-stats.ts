import { db, players } from "@workspace/db";
import { isNotNull, sql } from "drizzle-orm";

const SORARE_URL = "https://api.sorare.com/graphql";
const SORARE_AGENT = "Sorare Companion App";

export interface SorarePlayerStats {
  slug: string;
  displayName: string;
  position: string;
  avgScore: number | null;
  recentScores: number[];
  currentClub: string | null;
}

export async function fetchLiveStats(sorareSlugs: string[]): Promise<Map<string, SorarePlayerStats>> {
  const result = new Map<string, SorarePlayerStats>();
  if (!sorareSlugs.length) return result;

  const playerFields = `
    slug displayName position
    averageScore(type: LAST_FIFTEEN_SO5_AVERAGE_SCORE)
    so5Scores(last: 5) { score }
    activeClub { name }
  `;

  const BATCH = 20;
  for (let i = 0; i < sorareSlugs.length; i += BATCH) {
    const batch = sorareSlugs.slice(i, i + BATCH);
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
      const football = json?.data?.football;
      if (!football) continue;

      for (let j = 0; j < batch.length; j++) {
        const p = football[`p${j}`];
        if (!p?.slug) continue;
        result.set(p.slug, {
          slug: p.slug,
          displayName: p.displayName,
          position: p.position ?? "",
          avgScore: p.averageScore ?? null,
          recentScores: (p.so5Scores ?? []).map((s: any) => s.score as number),
          currentClub: p.activeClub?.name ?? null,
        });
      }
    } catch (err) {
      console.warn(`[sorare-stats] fetchLiveStats batch ${i / BATCH} failed:`, err);
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
  const stats = await fetchLiveStats(slugs);

  let updated = 0;
  let errors = 0;
  const now = new Date();

  const BATCH = 50;
  for (let i = 0; i < slugs.length; i += BATCH) {
    const batch = slugs.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (slug) => {
        const s = stats.get(slug);
        try {
          await db
            .update(players)
            .set({
              avgScore: s?.avgScore ?? null,
              recentScores: s?.recentScores ?? [],
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
