import { useState } from "react";
import { useSearchPlayers } from "@/hooks/useSorare";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import { RARITY_COLORS } from "@/lib/sorare";

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

  return (
    <div className="space-y-6" data-testid="page-players">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Player Explorer</h2>
        <p className="text-muted-foreground mt-1">
          Enter a player slug (e.g. "kylian-mbappe-lottin") to view SO5 scores and card data.
        </p>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-10 h-11 bg-card text-base"
          placeholder="e.g. kylian-mbappe-lottin"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="input-player-search"
        />
      </div>

      {query.length > 2 && (
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="bg-card">
                <CardContent className="p-6">
                  <div className="flex gap-4 items-center">
                    <Skeleton className="w-16 h-16 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="w-32 h-16" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : error ? (
            <div className="text-destructive text-sm p-4 bg-card rounded-lg border border-destructive/30">
              {(error as Error).message}
            </div>
          ) : players.length === 0 ? (
            <div className="text-muted-foreground p-8 text-center bg-card rounded-lg border border-border">
              No players found for "{query}". Try a different slug format (lowercase, hyphens instead of spaces).
            </div>
          ) : (
            players.map((card) => {
              const player = card.player;
              const scores = [...player.so5Scores].reverse();
              const chartData = scores.map((s, i) => ({ gw: i + 1, score: s.score }));

              const cardRaritiesForPlayer = cards?.filter((c) => c.player.slug === player.slug) || [];
              const raritySet = [...new Set(cardRaritiesForPlayer.map((c) => c.rarity.toUpperCase()))];

              return (
                <Card key={player.slug} className="bg-card" data-testid={`card-player-${player.slug}`}>
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row gap-5 items-start md:items-center">
                      {player.pictureUrl ? (
                        <img src={player.pictureUrl} alt={player.displayName} className="w-16 h-16 rounded-full bg-muted/30 object-cover shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground text-xs shrink-0">
                          N/A
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold" data-testid={`text-player-name-${player.slug}`}>{player.displayName}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                          {player.activeClub?.pictureUrl && (
                            <img src={player.activeClub.pictureUrl} alt="" className="w-4 h-4 object-contain" />
                          )}
                          <span>{player.activeClub?.name || "Free agent"}</span>
                          <span>·</span>
                          <span>{player.position}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {raritySet.map((r) => (
                            <span
                              key={r}
                              className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                              style={{
                                backgroundColor: RARITY_COLORS[r as keyof typeof RARITY_COLORS] || "#6b7280",
                                color: r === "SUPER_RARE" || r === "UNIQUE" ? "#fff" : "#000",
                              }}
                            >
                              {r.replace("_", " ")}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-5 w-full md:w-auto">
                        {chartData.length > 0 && (
                          <div className="flex-1 md:w-36 h-16">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData}>
                                <YAxis domain={[0, 100]} hide />
                                <Tooltip
                                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
                                  labelFormatter={(v) => `GW ${v}`}
                                  formatter={(v: number) => [v.toFixed(1), "Score"]}
                                />
                                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        <div className="text-center bg-muted/20 rounded-lg p-3 shrink-0 min-w-[80px]" data-testid={`text-avg-${player.slug}`}>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">L15 Avg</div>
                          <div className="text-2xl font-bold font-mono text-primary">
                            {player.averageScore != null ? player.averageScore.toFixed(0) : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {query.length === 0 && (
        <div className="text-muted-foreground text-sm p-8 bg-card/50 rounded-lg border border-border/50">
          <p className="font-medium mb-2">How to find a player slug</p>
          <p>Player slugs follow the pattern: <code className="bg-muted px-1 rounded text-xs">firstname-lastname</code></p>
          <p className="mt-1">Examples: <code className="bg-muted px-1 rounded text-xs">kylian-mbappe-lottin</code>, <code className="bg-muted px-1 rounded text-xs">erling-haaland</code>, <code className="bg-muted px-1 rounded text-xs">virgil-van-dijk</code></p>
        </div>
      )}
    </div>
  );
}
