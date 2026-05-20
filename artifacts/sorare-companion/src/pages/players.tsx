import { useState } from "react";
import {
  useSearchPlayers,
  usePlayerCards,
  useUpcomingFixtures,
  useFixtureGames,
  nameToSlug,
} from "@/hooks/useSorare";
import { formatEth, RARITY_COLORS } from "@/lib/sorare";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import type { SorareCard, PriceCard, Game } from "@/hooks/useSorare";

const RARITY_ORDER = ["unique", "super_rare", "rare", "limited"];

function RarityTag({ rarity }: { rarity: string }) {
  const key = rarity.toUpperCase() as keyof typeof RARITY_COLORS;
  const color = RARITY_COLORS[key] || "#6b7280";
  const darkText = key === "SUPER_RARE" || key === "UNIQUE";
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
      style={{ backgroundColor: color, color: darkText ? "#fff" : "#000" }}
    >
      {rarity.replace("_", " ")}
    </span>
  );
}

function PriceTable({ playerSlug }: { playerSlug: string }) {
  const { data: cards, isLoading } = usePlayerCards(playerSlug);

  if (isLoading) return <Skeleton className="h-24 w-full rounded" />;
  if (!cards || cards.length === 0)
    return (
      <p className="text-xs text-muted-foreground italic">
        No rare/limited cards with price data found.
      </p>
    );

  const byRarity: Record<string, PriceCard[]> = {};
  for (const c of cards) {
    if (!byRarity[c.rarity]) byRarity[c.rarity] = [];
    byRarity[c.rarity].push(c);
  }

  const sorted = RARITY_ORDER.filter((r) => byRarity[r]);

  if (sorted.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No rare/limited/SR/unique editions found.
      </p>
    );
  }

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Card Price History by Rarity
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {sorted.map((rarity) => {
          const group = byRarity[rarity];
          const withAuction = group.filter((c) => c.latestEnglishAuction);
          const prices = withAuction
            .map((c) => parseFloat(c.latestEnglishAuction!.currentPrice) / 1e18)
            .filter((p) => !isNaN(p) && p > 0)
            .sort((a, b) => a - b);
          const minPrice = prices[0];
          const maxPrice = prices[prices.length - 1];
          const latestDate = withAuction
            .map((c) => c.latestEnglishAuction!.endDate)
            .sort()
            .pop();

          return (
            <div
              key={rarity}
              className="bg-muted/20 rounded p-2.5 border border-border/30"
              data-testid={`price-${rarity}-${playerSlug}`}
            >
              <div className="mb-1">
                <RarityTag rarity={rarity} />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {group.length} card{group.length !== 1 ? "s" : ""} tracked
              </div>
              {prices.length > 0 ? (
                <>
                  <div className="font-mono text-sm font-bold text-primary mt-1">
                    {formatEth(minPrice * 1e18)} ETH
                    {minPrice !== maxPrice && (
                      <span className="text-muted-foreground font-normal text-xs">
                        {" "}– {formatEth(maxPrice * 1e18)}
                      </span>
                    )}
                  </div>
                  {latestDate && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Last sold {new Date(latestDate).toLocaleDateString()}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-muted-foreground mt-1 italic">No sales data</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UpcomingFixtures({ clubName }: { clubName: string }) {
  const { data: fixtures } = useUpcomingFixtures();
  const firstSlug = fixtures?.[0]?.slug ?? null;
  const secondSlug = fixtures?.[1]?.slug ?? null;
  const { data: games1 } = useFixtureGames(firstSlug);
  const { data: games2 } = useFixtureGames(secondSlug);

  if (!fixtures || fixtures.length === 0) return null;

  const allGames: { game: Game; gw: number }[] = [
    ...(games1 || []).map((g) => ({ game: g, gw: fixtures[0].gameWeek })),
    ...(games2 || []).map((g) => ({ game: g, gw: fixtures[1]?.gameWeek ?? 0 })),
  ];

  const clubGames = allGames.filter(
    ({ game }) =>
      game.homeTeam?.name === clubName || game.awayTeam?.name === clubName
  );

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Upcoming Fixtures
      </h4>
      {clubGames.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No upcoming fixtures found for {clubName} in the next two game weeks.
        </p>
      ) : (
        <div className="space-y-1.5">
          {clubGames.slice(0, 3).map(({ game, gw }) => {
            const isHome = game.homeTeam?.name === clubName;
            const opponent = isHome ? game.awayTeam : game.homeTeam;
            const kickoff = new Date(game.date);
            return (
              <div
                key={game.id}
                className="flex items-center gap-3 bg-muted/20 rounded px-3 py-2 text-xs"
                data-testid={`fixture-${game.id}`}
              >
                <span className="text-muted-foreground shrink-0 font-mono">GW{gw}</span>
                <span
                  className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    isHome
                      ? "bg-primary/15 text-primary"
                      : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {isHome ? "H" : "A"}
                </span>
                {opponent?.pictureUrl && (
                  <img
                    src={opponent.pictureUrl}
                    alt=""
                    className="w-4 h-4 object-contain shrink-0"
                  />
                )}
                <span className="flex-1 font-medium truncate">{opponent?.name ?? "TBD"}</span>
                <span className="text-muted-foreground shrink-0">
                  {kickoff.toLocaleDateString([], { day: "numeric", month: "short" })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlayerCard({ card }: { card: SorareCard }) {
  const player = card.player;
  const scores = [...player.so5Scores].reverse();
  const chartData = scores.map((s, i) => ({ gw: i + 1, score: s.score }));

  const parts = player.displayName.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : player.displayName.slice(0, 2).toUpperCase();

  return (
    <Card className="bg-card" data-testid={`card-player-${player.slug}`}>
      <CardContent className="p-5 space-y-5">
        {/* Header row */}
        <div className="flex gap-4 items-start">
          {/* Initials avatar — no pictureUrl in lean query */}
          <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-xl font-black select-none shrink-0">
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <h3
              className="text-xl font-bold"
              data-testid={`text-player-name-${player.slug}`}
            >
              {player.displayName}
            </h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
              <span>{player.activeClub?.name || "Free agent"}</span>
              <span>·</span>
              <span>{player.position}</span>
            </div>
          </div>

          {/* SO5 score sparkline + avg */}
          <div className="flex items-center gap-4 shrink-0">
            {chartData.length > 0 && (
              <div className="w-32 h-14 hidden sm:block">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                      labelFormatter={(v) => `GW ${v}`}
                      formatter={(v: number) => [v.toFixed(1), "Score"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div
              className="text-center bg-muted/20 rounded-lg p-3 min-w-[72px]"
              data-testid={`text-avg-${player.slug}`}
            >
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">L15 Avg</div>
              <div className="text-2xl font-bold font-mono text-primary">
                {player.averageScore != null ? player.averageScore.toFixed(0) : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Last 5 scores row */}
        {scores.length > 0 && (
          <div className="flex gap-2">
            {scores.map((s, i) => {
              const color =
                s.score >= 60
                  ? "border-green-500/50 text-green-400"
                  : s.score >= 40
                  ? "border-yellow-500/50 text-yellow-400"
                  : "border-red-500/50 text-red-400";
              return (
                <div
                  key={i}
                  className={`flex-1 text-center py-1.5 rounded border ${color} bg-muted/10`}
                >
                  <div className="text-[10px] text-muted-foreground">GW-{scores.length - i}</div>
                  <div className="font-mono font-bold text-sm">{s.score.toFixed(0)}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Price history by rarity */}
        <PriceTable playerSlug={player.slug} />

        {/* Upcoming fixtures */}
        {player.activeClub?.name && (
          <UpcomingFixtures clubName={player.activeClub.name} />
        )}
      </CardContent>
    </Card>
  );
}

export default function Players() {
  const [query, setQuery] = useState("");
  const { data: cards, isLoading, error } = useSearchPlayers(query);

  const players = cards
    ? (() => {
        const seen = new Set<string>();
        return cards.filter((c) => {
          if (seen.has(c.player.slug)) return false;
          seen.add(c.player.slug);
          return true;
        });
      })()
    : [];

  const generatedSlug = query.trim().length > 2 ? nameToSlug(query) : "";

  return (
    <div className="space-y-6" data-testid="page-players">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Player Explorer</h2>
        <p className="text-muted-foreground mt-1">
          Search by player name or Sorare slug to view scores, card prices, and upcoming fixtures.
        </p>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-10 h-11 bg-card text-base"
          placeholder="e.g. Haaland or erling-haaland"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="input-player-search"
        />
      </div>

      {generatedSlug && (
        <p className="text-xs text-muted-foreground -mt-3">
          Searching as slug:{" "}
          <code className="bg-muted px-1 rounded">{generatedSlug}</code>
        </p>
      )}

      {query.length > 2 && (
        <div className="space-y-4">
          {isLoading ? (
            <Card className="bg-card">
              <CardContent className="p-5 space-y-4">
                <div className="flex gap-4 items-center">
                  <Skeleton className="w-16 h-16 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ) : error ? (
            <div className="text-destructive text-sm p-4 bg-card rounded-lg border border-destructive/30">
              {(error as Error).message}
            </div>
          ) : players.length === 0 ? (
            <div className="text-muted-foreground p-8 text-center bg-card rounded-lg border border-border space-y-2">
              <p>No players found for "{generatedSlug}".</p>
              <p className="text-xs">
                Try a full slug like{" "}
                <button
                  className="text-primary underline"
                  onClick={() => setQuery("fikayo-tomori")}
                >
                  fikayo-tomori
                </button>{" "}
                or{" "}
                <button
                  className="text-primary underline"
                  onClick={() => setQuery("kylian-mbappe-lottin")}
                >
                  kylian-mbappe-lottin
                </button>
                .
              </p>
            </div>
          ) : (
            players.map((card) => <PlayerCard key={card.player.slug} card={card} />)
          )}
        </div>
      )}

      {query.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          {[
            "fikayo-tomori",
            "kylian-mbappe-lottin",
            "virgil-van-dijk",
            "bukayo-saka",
            "jude-bellingham",
            "vinicius-junior",
          ].map((slug) => (
            <button
              key={slug}
              className="text-left px-4 py-3 bg-card rounded-lg border border-border hover:border-primary/40 transition-colors"
              onClick={() => setQuery(slug)}
              data-testid={`quick-search-${slug}`}
            >
              <span className="text-muted-foreground text-xs">Try: </span>
              <span className="font-medium">{slug}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
