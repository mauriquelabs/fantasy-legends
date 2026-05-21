import { useQuery } from "@tanstack/react-query";
import { sorareQuery } from "@/lib/sorare";

/**
 * Sorare public unauthenticated API complexity limit: 500
 *
 * Validated safe combinations (tested against https://api.sorare.com/graphql):
 *  - allCards(first:15) with auction + so5Scores(last:5)  → ~390 complexity ✓
 *  - allCards(first:10) with auction + so5Scores(last:5)  → player search ✓
 *  - allCards(first:30) with just averageScore + clubName  → club strength ✓
 *  - allCards(first:20) with auction + so5Scores           → 523, EXCEEDS limit ✗
 *
 * Rules enforced here:
 *  - No pictureUrl or bestBid in list queries (adds per-card cost)
 *  - List queries: first ≤ 15
 *  - Player search: first ≤ 10
 *  - Club strength: first ≤ 30, minimal fields only
 */

/** Minimal card fields for list views — stays under 500 complexity at first:15 */
const CARD_LIST_FIELDS = `
  slug
  rarity
  serialNumber
  latestEnglishAuction {
    id
    endDate
    currentPrice
    minNextBid
  }
  player {
    slug
    displayName
    position
    averageScore(type: LAST_FIFTEEN_SO5_AVERAGE_SCORE)
    so5Scores(last: 5) { score }
    activeClub { name }
  }
`;

export interface SorareCard {
  slug: string;
  rarity: string;
  serialNumber: number;
  latestEnglishAuction: {
    id: string;
    endDate: string;
    currentPrice: string;
    minNextBid: string;
  } | null;
  player: {
    slug: string;
    displayName: string;
    position: string;
    averageScore: number | null;
    so5Scores: { score: number }[];
    activeClub: { name: string } | null;
  };
}

export interface PriceCard {
  slug: string;
  rarity: string;
  serialNumber: number;
  latestEnglishAuction: { endDate: string; currentPrice: string } | null;
}

export interface So5Fixture {
  gameWeek: number;
  startDate: string;
  endDate?: string;
  slug: string;
}

export interface Game {
  id: string;
  date: string;
  homeTeam: { name: string; pictureUrl: string; slug?: string } | null;
  awayTeam: { name: string; pictureUrl: string; slug?: string } | null;
  homeScore: number;
  awayScore: number;
}

/** Convert a display name to a Sorare-style slug */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Detect and re-throw with a friendly message for complexity errors */
function handleGraphqlErrors(errors: any[]) {
  if (!errors?.length) return;
  const first = errors[0];
  if (first.message?.includes("complexity")) {
    throw new Error(
      `Query too complex for public Sorare API. Complexity limit: 500. ${first.message.split(".")[0]}.`
    );
  }
  throw new Error(first.message || "Sorare API error");
}

async function fetchCards(
  queryName: string,
  first: number,
  extra: string
): Promise<SorareCard[]> {
  const query = `
    query ${queryName} {
      football {
        allCards(first: ${first}${extra}) {
          nodes { ${CARD_LIST_FIELDS} }
        }
      }
    }
  `;
  const data = await sorareQuery<any>(query);
  if (data?.errors) handleGraphqlErrors(data.errors);
  return ((data?.football?.allCards?.nodes || []) as SorareCard[]).filter(
    (c) => c.player != null
  );
}

export function usePopularCards() {
  return useQuery({
    queryKey: ["sorare", "popularCards"],
    queryFn: () =>
      fetchCards("PopularCards", 15, ", sorts: [POPULAR_FIRST]"),
    staleTime: 120000,
    refetchInterval: 120000,
  });
}

export function useRareCards() {
  return useQuery({
    queryKey: ["sorare", "rareCards"],
    queryFn: () =>
      fetchCards(
        "RareCards",
        15,
        ", rarities: [rare, super_rare, unique], sorts: [RECENTLY_OWNED_FIRST]"
      ),
    staleTime: 120000,
  });
}

export function useLimitedCards() {
  return useQuery({
    queryKey: ["sorare", "limitedCards"],
    queryFn: () =>
      fetchCards(
        "LimitedCards",
        15,
        ", rarities: [limited], sorts: [RECENTLY_OWNED_FIRST]"
      ),
    staleTime: 120000,
  });
}

/**
 * Hardcoded strength baseline for well-known clubs.
 * Sourced from typical Sorare SO5 player averages by league tier.
 * Used as fallback when a club isn't in the live API data.
 */
const CLUB_STRENGTH_BASELINE: Record<string, number> = {
  // English Premier League - Top 6
  "Manchester City FC": 58, "Arsenal FC": 57, "Liverpool FC": 57,
  "Chelsea FC": 54, "Manchester United FC": 53, "Tottenham Hotspur FC": 52,
  // Other PL
  "Newcastle United FC": 50, "Aston Villa FC": 51, "West Ham United FC": 49,
  "Brighton & Hove Albion FC": 49, "Wolves": 47, "Leicester City FC": 47,
  "Everton FC": 46, "Crystal Palace FC": 45, "Fulham FC": 45,
  // La Liga
  "Real Madrid CF": 59, "FC Barcelona": 58, "Club Atlético de Madrid": 56,
  "Sevilla FC": 52, "Real Betis Balompié": 51, "Real Sociedad": 50,
  "Athletic Club": 49, "Villarreal CF": 49, "Valencia CF": 48,
  // Bundesliga
  "FC Bayern München": 59, "Borussia Dortmund": 55, "Bayer 04 Leverkusen": 56,
  "RB Leipzig": 54, "Eintracht Frankfurt": 51, "VfB Stuttgart": 51,
  "Borussia Mönchengladbach": 49, "SC Freiburg": 48, "1. FC Union Berlin": 48,
  // Serie A
  "FC Internazionale Milano": 56, "AC Milan": 55, "SSC Napoli": 55,
  "Juventus FC": 54, "AS Roma": 52, "S.S. Lazio": 51,
  "Atalanta Bergamasca Calcio": 53, "ACF Fiorentina": 50, "Torino FC": 48,
  // Ligue 1
  "Paris Saint-Germain FC": 57, "Olympique de Marseille": 52,
  "Olympique Lyonnais": 51, "AS Monaco FC": 53, "LOSC Lille": 50,
  "Stade Rennais FC": 49, "RC Lens": 49, "OGC Nice": 49,
  // Eredivisie
  "AFC Ajax": 54, "PSV Eindhoven": 55, "Feyenoord": 52,
  "AZ Alkmaar": 50, "FC Utrecht": 48, "SC Heerenveen": 47,
  // Primeira Liga
  "SL Benfica": 53, "FC Porto": 53, "Sporting CP": 52,
  // Others
  "Celtic FC": 50, "Rangers FC": 49, "Club Brugge KV": 50,
  "RSC Anderlecht": 49, "Dinamo Zagreb": 48,
};

/**
 * Club strength map: clubName → avg SO5 score
 * Minimal query: first:30, only averageScore + clubName (well under 500 complexity)
 */
export function useClubStrength() {
  return useQuery({
    queryKey: ["sorare", "clubStrength"],
    queryFn: async () => {
      const query = `
        query ClubStrength {
          football {
            allCards(first: 30, sorts: [POPULAR_FIRST]) {
              nodes {
                player {
                  averageScore(type: LAST_FIFTEEN_SO5_AVERAGE_SCORE)
                  activeClub { name }
                }
              }
            }
          }
        }
      `;
      const data = await sorareQuery<any>(query);
      if (data?.errors) handleGraphqlErrors(data.errors);
      const nodes: any[] = data?.football?.allCards?.nodes || [];

      const strength: Record<string, number> = { ...CLUB_STRENGTH_BASELINE };
      const live: Record<string, number[]> = {};
      for (const node of nodes) {
        const club = node.player?.activeClub?.name as string | undefined;
        const score = node.player?.averageScore as number | null;
        if (club && score != null) {
          if (!live[club]) live[club] = [];
          live[club].push(score);
        }
      }
      for (const [club, scores] of Object.entries(live)) {
        strength[club] = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
      return strength;
    },
    staleTime: 300000,
  });
}

/**
 * Price-only cards for a player (limited/rare/SR/unique editions).
 * Minimal fields → low complexity even at first:10.
 */
export function usePlayerCards(playerSlug: string) {
  return useQuery({
    queryKey: ["sorare", "playerCards", playerSlug],
    queryFn: async () => {
      const query = `
        query PlayerCards($slugs: [String!]!) {
          football {
            allCards(first: 10, playerSlugs: $slugs, rarities: [limited, rare, super_rare, unique]) {
              nodes {
                slug
                rarity
                serialNumber
                latestEnglishAuction {
                  endDate
                  currentPrice
                }
              }
            }
          }
        }
      `;
      const data = await sorareQuery<any>(query, { slugs: [playerSlug] });
      if (data?.errors) handleGraphqlErrors(data.errors);
      return (data?.football?.allCards?.nodes || []) as PriceCard[];
    },
    enabled: !!playerSlug,
    staleTime: 60000,
  });
}

/**
 * Search players by slug (first:10 + full card fields stays under 500 complexity).
 */
export function useSearchPlayers(searchQuery: string) {
  return useQuery({
    queryKey: ["sorare", "searchPlayers", searchQuery],
    queryFn: async () => {
      const slug = nameToSlug(searchQuery);
      const query = `
        query PlayerSearch($slugs: [String!]!) {
          football {
            allCards(first: 10, playerSlugs: $slugs) {
              nodes { ${CARD_LIST_FIELDS} }
            }
          }
        }
      `;
      const data = await sorareQuery<any>(query, { slugs: [slug] });
      if (data?.errors) handleGraphqlErrors(data.errors);
      const nodes: SorareCard[] = data?.football?.allCards?.nodes || [];
      const seen = new Set<string>();
      return nodes.filter((c) => {
        if (!c.player || seen.has(c.player.slug)) return false;
        seen.add(c.player.slug);
        return true;
      });
    },
    enabled: searchQuery.trim().length > 2,
  });
}

export function useUpcomingFixtures() {
  return useQuery({
    queryKey: ["sorare", "upcomingFixtures"],
    queryFn: async () => {
      const query = `
        query UpcomingFixtures {
          so5 {
            so5Fixtures(first: 3) {
              nodes {
                gameWeek
                startDate
                endDate
                slug
              }
            }
          }
        }
      `;
      const data = await sorareQuery<any>(query);
      if (data?.errors) handleGraphqlErrors(data.errors);
      return (data?.so5?.so5Fixtures?.nodes || []) as So5Fixture[];
    },
  });
}

/**
 * National team cards for World Cup Hub.
 * Uses teamSlugs filter (confirmed under 500 complexity at first:15 with full fields).
 */
export function useNationalTeamCards(teamSlug: string | null) {
  return useQuery({
    queryKey: ["sorare", "nationalTeamCards", teamSlug],
    queryFn: async () => {
      if (!teamSlug) return [];
      // No rarity filter: WC2022 editions are common-only; WC2026 cards will appear here when released
      const query = `
        query NationalTeamCards($slugs: [String!]!) {
          football {
            allCards(first: 15, teamSlugs: $slugs, sorts: [POPULAR_FIRST]) {
              nodes { ${CARD_LIST_FIELDS} }
            }
          }
        }
      `;
      const data = await sorareQuery<any>(query, { slugs: [teamSlug] });
      if (data?.errors) handleGraphqlErrors(data.errors);
      const nodes: SorareCard[] = data?.football?.allCards?.nodes || [];
      const seen = new Set<string>();
      return nodes.filter((c) => {
        if (!c.player || seen.has(c.player.slug)) return false;
        seen.add(c.player.slug);
        return true;
      });
    },
    enabled: !!teamSlug,
    staleTime: 120000,
    refetchInterval: 120000,
  });
}

export function useFixtureGames(slug: string | null) {
  return useQuery({
    queryKey: ["sorare", "fixtureGames", slug],
    queryFn: async () => {
      if (!slug) return [];
      const query = `
        query FixtureGames($slug: String!) {
          so5 {
            so5Fixture(slug: $slug) {
              gameWeek
              startDate
              games {
                id
                date
                homeTeam { name pictureUrl slug }
                awayTeam { name pictureUrl slug }
                homeScore
                awayScore
              }
            }
          }
        }
      `;
      const data = await sorareQuery<any>(query, { slug });
      if (data?.errors) handleGraphqlErrors(data.errors);
      return (data?.so5?.so5Fixture?.games || []) as Game[];
    },
    enabled: !!slug,
  });
}
