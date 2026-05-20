import { useQuery } from "@tanstack/react-query";
import { sorareQuery } from "@/lib/sorare";

const CARD_FIELDS = `
  slug
  rarity
  serialNumber
  pictureUrl(derivative: "tinified")
  latestEnglishAuction {
    id
    endDate
    currentPrice
    minNextBid
    bestBid {
      amounts { wei }
    }
  }
  player {
    slug
    displayName
    position
    pictureUrl(derivative: "tinified")
    averageScore(type: LAST_FIFTEEN_SO5_AVERAGE_SCORE)
    so5Scores(last: 5) {
      score
    }
    activeClub {
      name
      pictureUrl
    }
  }
`;

export interface SorareCard {
  slug: string;
  rarity: string;
  serialNumber: number;
  pictureUrl: string | null;
  latestEnglishAuction: {
    id: string;
    endDate: string;
    currentPrice: string;
    minNextBid: string;
    bestBid: { amounts: { wei: string } } | null;
  } | null;
  player: {
    slug: string;
    displayName: string;
    position: string;
    pictureUrl: string | null;
    averageScore: number | null;
    so5Scores: { score: number }[];
    activeClub: { name: string; pictureUrl: string } | null;
  };
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
  homeTeam: { name: string; pictureUrl: string } | null;
  awayTeam: { name: string; pictureUrl: string } | null;
  homeScore: number;
  awayScore: number;
}

export function usePopularCards() {
  return useQuery({
    queryKey: ["sorare", "popularCards"],
    queryFn: async () => {
      const query = `
        query PopularCards {
          football {
            allCards(first: 40, sorts: [POPULAR_FIRST]) {
              nodes {
                ${CARD_FIELDS}
              }
            }
          }
        }
      `;
      const data = await sorareQuery<any>(query);
      const nodes: SorareCard[] = data?.football?.allCards?.nodes || [];
      return nodes.filter((c) => c.player != null);
    },
    staleTime: 120000,
    refetchInterval: 120000,
  });
}

export function useRareCards() {
  return useQuery({
    queryKey: ["sorare", "rareCards"],
    queryFn: async () => {
      const query = `
        query RareCards {
          football {
            allCards(first: 40, rarities: [rare, super_rare, unique], sorts: [RECENTLY_OWNED_FIRST]) {
              nodes {
                ${CARD_FIELDS}
              }
            }
          }
        }
      `;
      const data = await sorareQuery<any>(query);
      const nodes: SorareCard[] = data?.football?.allCards?.nodes || [];
      return nodes.filter((c) => c.player != null);
    },
    staleTime: 120000,
  });
}

export function useLimitedCards() {
  return useQuery({
    queryKey: ["sorare", "limitedCards"],
    queryFn: async () => {
      const query = `
        query LimitedCards {
          football {
            allCards(first: 40, rarities: [limited], sorts: [RECENTLY_OWNED_FIRST]) {
              nodes {
                ${CARD_FIELDS}
              }
            }
          }
        }
      `;
      const data = await sorareQuery<any>(query);
      const nodes: SorareCard[] = data?.football?.allCards?.nodes || [];
      return nodes.filter((c) => c.player != null);
    },
    staleTime: 120000,
  });
}

export function useSearchPlayers(searchQuery: string) {
  return useQuery({
    queryKey: ["sorare", "searchPlayers", searchQuery],
    queryFn: async () => {
      const slug = searchQuery.toLowerCase().trim().replace(/\s+/g, "-");
      const query = `
        query PlayerSearch($slugs: [String!]!) {
          football {
            allCards(first: 20, playerSlugs: $slugs) {
              nodes {
                ${CARD_FIELDS}
              }
            }
          }
        }
      `;
      const data = await sorareQuery<any>(query, { slugs: [slug] });
      const nodes: SorareCard[] = data?.football?.allCards?.nodes || [];
      const seen = new Set<string>();
      return nodes.filter((c) => {
        if (seen.has(c.player.slug)) return false;
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
      return (data?.so5?.so5Fixtures?.nodes || []) as So5Fixture[];
    },
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
                homeTeam { name pictureUrl }
                awayTeam { name pictureUrl }
                homeScore
                awayScore
              }
            }
          }
        }
      `;
      const data = await sorareQuery<any>(query, { slug });
      return (data?.so5?.so5Fixture?.games || []) as Game[];
    },
    enabled: !!slug,
  });
}
