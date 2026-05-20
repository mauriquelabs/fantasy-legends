import { useState } from "react";
import { usePopularCards, useRareCards, useLimitedCards } from "@/hooks/useSorare";
import { formatEth, RARITY_COLORS } from "@/lib/sorare";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SorareCard } from "@/hooks/useSorare";

type Tab = "popular" | "rare" | "limited";

function RarityBadge({ rarity }: { rarity: string }) {
  const key = rarity.toUpperCase() as keyof typeof RARITY_COLORS;
  const color = RARITY_COLORS[key] || "#6b7280";
  const light = key === "LIMITED" || key === "RARE";
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: color, color: light ? "#000" : "#fff" }}
    >
      {rarity.replace("_", " ")}
    </span>
  );
}

function ScoreBar({ scores }: { scores: { score: number }[] }) {
  if (!scores.length) return <div className="text-xs text-muted-foreground">No scores</div>;
  return (
    <div className="flex items-end gap-0.5 h-6">
      {scores.map((s, i) => {
        const h = Math.max(2, Math.round((s.score / 100) * 24));
        const color = s.score >= 60 ? "#22c55e" : s.score >= 40 ? "#f5c518" : "#ef4444";
        return (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{ height: h, backgroundColor: color, opacity: 0.85 }}
            title={`${s.score.toFixed(1)}`}
          />
        );
      })}
    </div>
  );
}

function CardGrid({ cards, isLoading }: { cards: SorareCard[] | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="bg-card">
            <CardContent className="p-0">
              <Skeleton className="h-48 w-full rounded-t-lg rounded-b-none" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-6 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="text-center p-12 bg-card rounded-lg border border-border text-muted-foreground">
        No cards found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {cards.map((card) => {
        const player = card.player;
        const auction = card.latestEnglishAuction;
        const scores = [...player.so5Scores].reverse();
        return (
          <Card
            key={card.slug}
            className="bg-card hover:border-primary/40 transition-colors overflow-hidden flex flex-col group"
            data-testid={`card-market-${card.slug}`}
          >
            <div className="relative bg-muted/20 overflow-hidden" style={{ height: 180 }}>
              {card.pictureUrl ? (
                <img
                  src={card.pictureUrl}
                  alt={player.displayName}
                  className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No image
                </div>
              )}
              <div className="absolute top-2 left-2">
                <RarityBadge rarity={card.rarity} />
              </div>
              {card.serialNumber > 0 && (
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-mono px-1.5 py-0.5 rounded">
                  #{card.serialNumber}
                </div>
              )}
            </div>

            <CardContent className="p-3 flex-1 flex flex-col gap-2">
              <div>
                <h3
                  className="font-bold text-sm leading-tight truncate"
                  title={player.displayName}
                  data-testid={`text-player-${card.slug}`}
                >
                  {player.displayName}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                  {player.activeClub?.pictureUrl && (
                    <img src={player.activeClub.pictureUrl} alt="" className="w-3 h-3 object-contain" />
                  )}
                  <span className="truncate">{player.activeClub?.name || "Free agent"}</span>
                  <span>·</span>
                  <span>{player.position}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <ScoreBar scores={scores} />
                </div>
                {player.averageScore != null && (
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-muted-foreground">L15</div>
                    <div className="text-base font-bold font-mono text-primary leading-tight">
                      {player.averageScore.toFixed(0)}
                    </div>
                  </div>
                )}
              </div>

              {auction && (
                <div className="border-t border-border/50 pt-2 flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">
                    Last sold {new Date(auction.endDate).toLocaleDateString()}
                  </span>
                  <span className="font-mono text-primary font-medium">
                    {formatEth(auction.currentPrice)} ETH
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function Auctions() {
  const [tab, setTab] = useState<Tab>("popular");
  const { data: popular, isLoading: loadingPop } = usePopularCards();
  const { data: rare, isLoading: loadingRare } = useRareCards();
  const { data: limited, isLoading: loadingLimited } = useLimitedCards();

  const current = tab === "popular" ? popular : tab === "rare" ? rare : limited;
  const loading = tab === "popular" ? loadingPop : tab === "rare" ? loadingRare : loadingLimited;

  const tabs: { key: Tab; label: string }[] = [
    { key: "popular", label: "Popular" },
    { key: "rare", label: "Rare / SR / Unique" },
    { key: "limited", label: "Limited" },
  ];

  return (
    <div className="space-y-5" data-testid="page-auctions">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Market Activity</h2>
        <p className="text-muted-foreground mt-1">
          Sorare card market data — player scores, rarity, and last sale prices.
        </p>
      </div>

      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg w-fit">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      <CardGrid cards={current} isLoading={loading} />
    </div>
  );
}
