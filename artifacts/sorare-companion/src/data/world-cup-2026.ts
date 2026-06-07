export interface WCTeam {
  name: string;
  /** Sorare national team slug (lowercase, hyphenated) */
  slug: string;
  flag: string;
  confederation: "UEFA" | "CONMEBOL" | "CONCACAF" | "CAF" | "AFC" | "OFC";
}

export const WORLD_CUP_2026_TEAMS: WCTeam[] = [
  // UEFA (16)
  { name: "France",               slug: "france",             flag: "🇫🇷", confederation: "UEFA" },
  { name: "Spain",                slug: "spain",              flag: "🇪🇸", confederation: "UEFA" },
  { name: "England",              slug: "england",            flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", confederation: "UEFA" },
  { name: "Germany",              slug: "germany",            flag: "🇩🇪", confederation: "UEFA" },
  { name: "Portugal",             slug: "portugal",           flag: "🇵🇹", confederation: "UEFA" },
  { name: "Netherlands",          slug: "netherlands",        flag: "🇳🇱", confederation: "UEFA" },
  { name: "Belgium",              slug: "belgium",            flag: "🇧🇪", confederation: "UEFA" },
  { name: "Croatia",              slug: "croatia",            flag: "🇭🇷", confederation: "UEFA" },
  { name: "Switzerland",          slug: "switzerland",        flag: "🇨🇭", confederation: "UEFA" },
  { name: "Austria",              slug: "austria",            flag: "🇦🇹", confederation: "UEFA" },
  { name: "Turkey",               slug: "turkey",             flag: "🇹🇷", confederation: "UEFA" },
  { name: "Scotland",             slug: "scotland",           flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", confederation: "UEFA" },
  { name: "Norway",               slug: "norway",             flag: "🇳🇴", confederation: "UEFA" },
  { name: "Sweden",               slug: "sweden",             flag: "🇸🇪", confederation: "UEFA" },
  { name: "Czechia",              slug: "czech-republic",     flag: "🇨🇿", confederation: "UEFA" },
  { name: "Bosnia & Herzegovina", slug: "bosnia-herzegovina", flag: "🇧🇦", confederation: "UEFA" },
  // CONMEBOL (6)
  { name: "Argentina",            slug: "argentina",          flag: "🇦🇷", confederation: "CONMEBOL" },
  { name: "Brazil",               slug: "brazil",             flag: "🇧🇷", confederation: "CONMEBOL" },
  { name: "Colombia",             slug: "colombia",           flag: "🇨🇴", confederation: "CONMEBOL" },
  { name: "Uruguay",              slug: "uruguay",            flag: "🇺🇾", confederation: "CONMEBOL" },
  { name: "Ecuador",              slug: "ecuador",            flag: "🇪🇨", confederation: "CONMEBOL" },
  { name: "Paraguay",             slug: "paraguay",           flag: "🇵🇾", confederation: "CONMEBOL" },
  // CONCACAF (6)
  { name: "United States",        slug: "united-states",      flag: "🇺🇸", confederation: "CONCACAF" },
  { name: "Mexico",               slug: "mexico",             flag: "🇲🇽", confederation: "CONCACAF" },
  { name: "Canada",               slug: "canada",             flag: "🇨🇦", confederation: "CONCACAF" },
  { name: "Panama",               slug: "panama",             flag: "🇵🇦", confederation: "CONCACAF" },
  { name: "Haiti",                slug: "haiti",              flag: "🇭🇹", confederation: "CONCACAF" },
  { name: "Curaçao",              slug: "curacao",            flag: "🇨🇼", confederation: "CONCACAF" },
  // CAF (9)
  { name: "Morocco",              slug: "morocco",            flag: "🇲🇦", confederation: "CAF" },
  { name: "Senegal",              slug: "senegal",            flag: "🇸🇳", confederation: "CAF" },
  { name: "Egypt",                slug: "egypt",              flag: "🇪🇬", confederation: "CAF" },
  { name: "Côte d'Ivoire",        slug: "cote-d-ivoire",      flag: "🇨🇮", confederation: "CAF" },
  { name: "South Africa",         slug: "south-africa",       flag: "🇿🇦", confederation: "CAF" },
  { name: "Tunisia",              slug: "tunisia",            flag: "🇹🇳", confederation: "CAF" },
  { name: "Ghana",                slug: "ghana",              flag: "🇬🇭", confederation: "CAF" },
  { name: "Algeria",              slug: "algeria",            flag: "🇩🇿", confederation: "CAF" },
  { name: "Congo DR",             slug: "congo-dr",           flag: "🇨🇩", confederation: "CAF" },
  // AFC (8)
  { name: "Japan",                slug: "japan",              flag: "🇯🇵", confederation: "AFC" },
  { name: "South Korea",          slug: "korea-republic",     flag: "🇰🇷", confederation: "AFC" },
  { name: "Iran",                 slug: "iran",               flag: "🇮🇷", confederation: "AFC" },
  { name: "Australia",            slug: "australia",          flag: "🇦🇺", confederation: "AFC" },
  { name: "Saudi Arabia",         slug: "saudi-arabia",       flag: "🇸🇦", confederation: "AFC" },
  { name: "Iraq",                 slug: "iraq",               flag: "🇮🇶", confederation: "AFC" },
  { name: "Jordan",               slug: "jordan",             flag: "🇯🇴", confederation: "AFC" },
  { name: "Uzbekistan",           slug: "uzbekistan",         flag: "🇺🇿", confederation: "AFC" },
  // OFC (1)
  { name: "New Zealand",          slug: "new-zealand",        flag: "🇳🇿", confederation: "OFC" },
  // Playoff winners
  { name: "Qatar",                slug: "qatar",              flag: "🇶🇦", confederation: "AFC" },
  { name: "Cape Verde",           slug: "cape-verde-islands", flag: "🇨🇻", confederation: "CAF" },
];

export const CONFEDERATION_COLORS: Record<WCTeam["confederation"], string> = {
  UEFA: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  CONMEBOL: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  CONCACAF: "bg-green-500/15 text-green-400 border-green-500/30",
  CAF: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  AFC: "bg-red-500/15 text-red-400 border-red-500/30",
  OFC: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};
