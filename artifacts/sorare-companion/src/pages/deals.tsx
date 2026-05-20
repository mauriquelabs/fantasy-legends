import { useMemo } from "react";
import { usePopularCards, useRareCards } from "@/hooks/useSorare";
import { formatEth, RARITY_COLORS } from "@/lib/sorare";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SorareCard } from "@/hooks/useSorare";

type DealCard = SorareCard & { valuePer: number };

function ValueScore({ card }: { card: DealCard }) {
  const auction = card.latestEnglishAuction;
  const player = card.player;
  const key = card.rarity.toUpperCase() as keyof typeof RARITY_COLORS;
  const color = RARITY_COLORS[key] || "#6b7280";
  const scores = [...player.so5Scores].reverse();

  const parts = player.displayName.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : player.displayName.slice(0, 2).toUpperCase();

  return (
    <Card
      className="bg-card hover:border-primary/30 transition-colors"
      data-testid={`card-deal-${card.slug}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Initials avatar (no pictureUrl in lean query) */}
          <div
            className="w-12 h-14 rounded flex items-center justify-center shrink-0 text-lg font-black select-none"
            style={{
              background: `linear-gradient(135deg, ${color}22 0%, ${color}55 100%)`,
              color,
            }}
          >
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: color,
                  color: key === "SUPER_RARE" || key === "UNIQUE" ? "#fff" : "#000",
                }}
              >
                {card.rarity.replace("_", " ")}
              </span>
              {card.serialNumber > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  #{card.serialNumber}
                </span>
              )}
            </div>
            <h3
              className="font-bold text-base leading-tight truncate"
              data-testid={`text-player-deal-${card.slug}`}
            >
              {player.displayName}
            </h3>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {player.activeClub?.name || "Free agent"} · {player.position}
            </div>

            <div className="flex items-end gap-3 mt-2">
              {scores.length > 0 && (
                <div className="flex items-end gap-0.5 h-5">
                  {scores.map((s, i) => {
                    const h = Math.max(2, Math.round((s.score / 100) * 20));
                    const c = s.score >= 60 ? "#22c55e" : s.score >= 40 ? "#f5c518" : "#ef4444";
                    return (
                      <div
                        key={i}
                        className="w-2 rounded-sm"
                        style={{ height: h, backgroundColor: c, opacity: 0.85 }}
                        title={s.score.toFixed(1)}
                      />
                    );
                  })}
                </div>
              )}
              {player.averageScore != null && (
                <span className="text-sm font-mono text-primary font-bold">
                  {player.averageScore.toFixed(0)} avg
                </span>
              )}
            </div>
          </div>

          <div
            className="shrink-0 text-center bg-primary/10 rounded-lg px-3 py-2 border border-primary/20"
            data-testid={`badge-value-${card.slug}`}
          >
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Score/ETH</div>
            <div className="text-lg font-bold font-mono text-primary">
              {card.valuePer > 9999 ? "∞" : card.valuePer.toFixed(0)}
            </div>
          </div>
        </div>

        {auction && (
          <div className="mt-3 pt-3 border-t border-border/50 flex justify-between items-center text-xs">
            <span className="text-muted-foreground">
              Last sold {new Date(auction.endDate).toLocaleDateString()}
            </span>
            <span className="font-mono text-muted-foreground">
              {formatEth(auction.currentPrice)} ETH
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Deals() {
  const { data: popular, isLoading: loadingPop, error: errPop } = usePopularCards();
  const { data: rare, isLoading: loadingRare, error: errRare } = useRareCards();

  const deals = useMemo(() => {
    const all = [...(popular || []), ...(rare || [])];
    const seen = new Set<string>();
    const unique = all.filter((c) => {
      if (seen.has(c.slug)) return false;
      seen.add(c.slug);
      return true;
    });

    return unique
      .filter((c) => c.player.averageScore != null && c.player.averageScore > 0)
      .map((c) => {
        const priceEth = c.latestEnglishAuction
          ? parseFloat(c.latestEnglishAuction.currentPrice) / 1e18
          : null;
        const valuePer =
          priceEth && priceEth > 0 && c.player.averageScore
            ? c.player.averageScore / priceEth
            : 0;
        return { ...c, valuePer } as DealCard;
      })
      .filter((c) => c.valuePer > 0)
      .sort((a, b) => b.valuePer - a.valuePer);
  }, [popular, rare]);

  const isLoading = loadingPop || loadingRare;
  const error = errPop || errRare;

  return (
    <div className="space-y-6" data-testid="page-deals">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Deal Finder</h2>
        <p className="text-muted-foreground mt-1">
          Cards ranked by SO5 average score per ETH of last sale price — higher is better value.
        </p>
      </div>

      {error ? (
        <div className="text-destructive text-sm p-6 bg-card rounded-lg border border-destructive/30">
          {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-card">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Skeleton className="w-12 h-14 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="w-16 h-14 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div className="text-center p-12 bg-card rounded-lg border border-border text-muted-foreground">
          No cards with both score and price data found right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deals.slice(0, 20).map((deal) => (
            <ValueScore key={deal.slug} card={deal} />
          ))}
        </div>
      )}
    </div>
  );
}
