import { db, players } from "@workspace/db";
import { eq, isNotNull } from "drizzle-orm";
import { logger } from "./logger";

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

export interface SorareFixture {
  slug: string;
  startDate: string;
  endDate: string;
}

export async function fetchFixture(slug: string): Promise<SorareFixture | null> {
  try {
    const res = await fetch(SORARE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
      body: JSON.stringify({
        query: `query { so5 { so5Fixture(slug: ${JSON.stringify(slug)}) { slug startDate endDate } } }`,
      }),
    });
    const json: any = await res.json();
    return json?.data?.so5?.so5Fixture ?? null;
  } catch (err) {
    logger.warn({ err, slug }, "fetchFixture failed");
    return null;
  }
}

export async function fetchUpcomingFixtures(): Promise<SorareFixture[]> {
  try {
    const res = await fetch(SORARE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
      body: JSON.stringify({
        query: `query { so5 { so5Fixtures(first: 8) { nodes { slug startDate endDate } } } }`,
      }),
    });
    const json: any = await res.json();
    const nodes: SorareFixture[] = json?.data?.so5?.so5Fixtures?.nodes ?? [];
    const now = new Date();
    return nodes.filter(f => new Date(f.endDate) >= now);
  } catch (err) {
    logger.warn({ err }, "fetchUpcomingFixtures failed");
    return [];
  }
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
        logger.warn({ errors: json.errors, batch: batchNum }, "sorare batch GraphQL errors");
      }

      const football = json?.data?.football;
      if (!football) {
        logger.warn({ batch: batchNum, status: res.status, slugs: batch }, "sorare batch returned no football data");
        continue;
      }

      for (let j = 0; j < batch.length; j++) {
        const p = football[`p${j}`];
        if (!p?.slug) {
          logger.warn({ batch: batchNum, slug: batch[j] }, "sorare returned null for slug");
          continue;
        }
        if (p.slug !== batch[j]) {
          logger.warn({ batch: batchNum, queried: batch[j], got: p.slug }, "sorare slug mismatch");
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
          gamesPlayedLast15: last15.length,
          currentClub: p.activeClub?.name ?? null,
        });
      }
    } catch (err) {
      logger.warn({ err, batch: batchNum }, "sorare batch fetch failed");
    }

    if (i + BATCH < sorareSlugs.length) {
      await new Promise(r => setTimeout(r, 150));
    }
  }
  return result;
}

export interface FixturePlayerScore {
  slug: string;
  displayName: string;
  position: string;
  currentClub: string | null;
  score: number;
}

export async function fetchFixtureTopPlayers(fixtureSlug: string, limit = 20): Promise<FixturePlayerScore[]> {
  try {
    const res = await fetch(SORARE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": SORARE_AGENT },
      body: JSON.stringify({
        query: `query FixtureTopPlayers {
          so5 {
            so5Fixture(slug: ${JSON.stringify(fixtureSlug)}) {
              so5Appearances(first: ${limit}, sortBy: SCORE_DESC) {
                nodes {
                  score
                  player {
                    slug displayName position
                    activeClub { name }
                  }
                }
              }
            }
          }
        }`,
      }),
    });
    const json: any = await res.json();
    if (json?.errors?.length) {
      logger.warn({ errors: json.errors, fixtureSlug }, "fetchFixtureTopPlayers GraphQL errors");
    }
    const nodes = json?.data?.so5?.so5Fixture?.so5Appearances?.nodes ?? [];
    return nodes
      .filter((n: any) => n?.score != null && n?.player?.slug)
      .map((n: any) => ({
        slug: n.player.slug,
        displayName: n.player.displayName,
        position: n.player.position ?? "",
        currentClub: n.player.activeClub?.name ?? null,
        score: n.score,
      }));
  } catch (err) {
    logger.warn({ err, fixtureSlug }, "fetchFixtureTopPlayers failed");
    return [];
  }
}

export async function syncAllPlayerScores(): Promise<{ updated: number; errors: number }> {
  const rows = await db
    .select({ sorareSlug: players.sorareSlug })
    .from(players)
    .where(isNotNull(players.sorareSlug));

  const slugs = rows.map(r => r.sorareSlug!);
  logger.info({ count: slugs.length }, "starting sorare score sync");
  const stats = await fetchLiveStats(slugs);

  const missing = slugs.filter(s => !stats.has(s));
  logger.info({ returned: stats.size, total: slugs.length }, "sorare data fetched");
  if (missing.length) {
    logger.warn({ count: missing.length, slugs: missing }, "slugs with no sorare data");
  }

  let updated = 0;
  let errors = 0;
  const now = new Date();

  const BATCH = 10;
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
            .where(eq(players.sorareSlug, slug));
          updated++;
        } catch (err) {
          logger.warn({ err, slug }, "failed to update player scores");
          errors++;
        }
      })
    );
  }

  return { updated, errors };
}
