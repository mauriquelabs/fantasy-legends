/** Static national-team rosters used by competition sync adapters. */
export interface CompetitionTeamRef {
  slug: string;
  name: string;
  fdId: number;
}

/** FIFA World Cup 2026 — Sorare slug + football-data.org team ID. */
export const WC_2026_TEAMS: CompetitionTeamRef[] = [
  // UEFA (16)
  { slug: "france", name: "France", fdId: 773 },
  { slug: "spain", name: "Spain", fdId: 760 },
  { slug: "england", name: "England", fdId: 770 },
  { slug: "germany", name: "Germany", fdId: 759 },
  { slug: "portugal", name: "Portugal", fdId: 765 },
  { slug: "netherlands", name: "Netherlands", fdId: 8601 },
  { slug: "belgium", name: "Belgium", fdId: 805 },
  { slug: "croatia", name: "Croatia", fdId: 799 },
  { slug: "switzerland", name: "Switzerland", fdId: 788 },
  { slug: "austria", name: "Austria", fdId: 816 },
  { slug: "turkey", name: "Turkey", fdId: 803 },
  { slug: "scotland", name: "Scotland", fdId: 8873 },
  { slug: "norway", name: "Norway", fdId: 8872 },
  { slug: "sweden", name: "Sweden", fdId: 792 },
  { slug: "czech-republic", name: "Czechia", fdId: 798 },
  { slug: "bosnia-herzegovina", name: "Bosnia & Herzegovina", fdId: 1060 },
  // CONMEBOL (6)
  { slug: "argentina", name: "Argentina", fdId: 762 },
  { slug: "brazil", name: "Brazil", fdId: 764 },
  { slug: "colombia", name: "Colombia", fdId: 818 },
  { slug: "uruguay", name: "Uruguay", fdId: 758 },
  { slug: "ecuador", name: "Ecuador", fdId: 791 },
  { slug: "paraguay", name: "Paraguay", fdId: 761 },
  // CONCACAF (6)
  { slug: "united-states", name: "United States", fdId: 771 },
  { slug: "mexico", name: "Mexico", fdId: 769 },
  { slug: "canada", name: "Canada", fdId: 828 },
  { slug: "panama", name: "Panama", fdId: 1836 },
  { slug: "haiti", name: "Haiti", fdId: 836 },
  { slug: "curacao", name: "Curaçao", fdId: 9460 },
  // CAF (9)
  { slug: "morocco", name: "Morocco", fdId: 815 },
  { slug: "senegal", name: "Senegal", fdId: 804 },
  { slug: "egypt", name: "Egypt", fdId: 825 },
  { slug: "cote-d-ivoire", name: "Côte d'Ivoire", fdId: 1935 },
  { slug: "south-africa", name: "South Africa", fdId: 774 },
  { slug: "tunisia", name: "Tunisia", fdId: 802 },
  { slug: "ghana", name: "Ghana", fdId: 763 },
  { slug: "algeria", name: "Algeria", fdId: 778 },
  { slug: "congo-dr", name: "Congo DR", fdId: 1934 },
  // AFC (8)
  { slug: "japan", name: "Japan", fdId: 766 },
  { slug: "korea-republic", name: "South Korea", fdId: 772 },
  { slug: "iran", name: "Iran", fdId: 840 },
  { slug: "australia", name: "Australia", fdId: 779 },
  { slug: "saudi-arabia", name: "Saudi Arabia", fdId: 801 },
  { slug: "iraq", name: "Iraq", fdId: 8062 },
  { slug: "jordan", name: "Jordan", fdId: 8049 },
  { slug: "uzbekistan", name: "Uzbekistan", fdId: 8070 },
  // OFC (1)
  { slug: "new-zealand", name: "New Zealand", fdId: 783 },
  // Playoff winners
  { slug: "qatar", name: "Qatar", fdId: 8030 },
  { slug: "cape-verde-islands", name: "Cape Verde", fdId: 1930 },
];

const ROSTERS: Record<string, CompetitionTeamRef[]> = {
  WC: WC_2026_TEAMS,
};

export function getCompetitionRoster(code: string): CompetitionTeamRef[] {
  return ROSTERS[code] ?? [];
}

export function fdIdToSorareSlug(code: string): Map<number, string> {
  return new Map(getCompetitionRoster(code).map((t) => [t.fdId, t.slug]));
}
