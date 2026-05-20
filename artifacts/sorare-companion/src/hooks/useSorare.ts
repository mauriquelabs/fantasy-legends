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

export function usePopularCards() {
  return useQuery({
    queryKey: ["sorare", "popularCards"],
    queryFn: async () => {
      const query = `
        query PopularCards {
          football {
            allCards(first: 40, sorts: [POPULAR_FIRST]) {
              nodes { ${CARD_FIELDS} }
            }
          }
        }
      `;
      const data = await sorareQuery<any>(query);
      return ((data?.football?.allCards?.nodes || []) as SorareCard[]).filter(
        (c) => c.player != null
      );
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
              nodes { ${CARD_FIELDS} }
            }
          }
        }
      `;
      const data = await sorareQuery<any>(query);
      return ((data?.football?.allCards?.nodes || []) as SorareCard[]).filter(
        (c) => c.player != null
      );
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
              nodes { ${CARD_FIELDS} }
            }
          }
        }
      `;
      const data = await sorareQuery<any>(query);
      return ((data?.football?.allCards?.nodes || []) as SorareCard[]).filter(
        (c) => c.player != null
      );
    },
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
  // Other PL clubs
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

/** Strength map: clubName → average SO5 score of popular players */
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
      const nodes: any[] = data?.football?.allCards?.nodes || [];

      // Start with hardcoded baseline
      const strength: Record<string, number> = { ...CLUB_STRENGTH_BASELINE };

      // Override/supplement with live API data
      const clubScores: Record<string, number[]> = {};
      for (const node of nodes) {
        const club = node.player?.activeClub?.name as string | undefined;
        const score = node.player?.averageScore as number | null;
        if (club && score != null) {
          if (!clubScores[club]) clubScores[club] = [];
          clubScores[club].push(score);
        }
      }
      for (const [club, scores] of Object.entries(clubScores)) {
        strength[club] = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
      return strength;
    },
    staleTime: 300000,
  });
}

/** All non-common cards for a player — rarity + last sale price history */
export function usePlayerCards(playerSlug: string) {
  return useQuery({
    queryKey: ["sorare", "playerCards", playerSlug],
    queryFn: async () => {
      const query = `
        query PlayerCards($slugs: [String!]!) {
          football {
            allCards(first: 20, playerSlugs: $slugs, rarities: [limited, rare, super_rare, unique]) {
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
      return (data?.football?.allCards?.nodes || []) as PriceCard[];
    },
    enabled: !!playerSlug,
    staleTime: 60000,
  });
}

export function useSearchPlayers(searchQuery: string) {
  return useQuery({
    queryKey: ["sorare", "searchPlayers", searchQuery],
    queryFn: async () => {
      const slug = nameToSlug(searchQuery);
      const query = `
        query PlayerSearch($slugs: [String!]!) {
          football {
            allCards(first: 20, playerSlugs: $slugs) {
              nodes { ${CARD_FIELDS} }
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
      return (data?.so5?.so5Fixture?.games || []) as Game[];
    },
    enabled: !!slug,
  });
}
