import { useMemo } from "react";
import { usePopularCards, useRareCards, useLimitedCards } from "@/hooks/useSorare";
import { formatEth, RARITY_COLORS } from "@/lib/sorare";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, Info } from "lucide-react";
import type { SorareCard } from "@/hooks/useSorare";

type DealCard = SorareCard & {
  priceEth: number;
  rarityAvgEth: number;
  discountPct: number;
};

function PlayerAvatar({ name, rarity }: { name: string; rarity: string }) {
  const key = rarity.toUpperCase() as keyof typeof RARITY_COLORS;
  const color = RARITY_COLORS[key] || "#6b7280";
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return (
    <div
      className="w-12 h-14 rounded flex items-center justify-center shrink-0 font-black text-sm select-none"
      style={{ background: `linear-gradient(135deg, ${color}22, ${color}55)`, color }}
    >
      {initials}
    </div>
  );
}

function DiscountBadge({ pct }: { pct: number }) {
  const isGood = pct > 0;
  return (
    <div
      className={`shrink-0 text-center rounded-lg px-3 py-2 border min-w-[80px] ${
        isGood
          ? "bg-green-500/10 border-green-500/20"
          : "bg-red-500/10 border-red-500/20"
      }`}
      title={`${Math.abs(pct).toFixed(1)}% ${isGood ? "below" : "above"} rarity average`}
    >
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">vs avg</div>
      <div
        className={`text-lg font-bold font-mono ${
          isGood ? "text-green-400" : "text-red-400"
        }`}
      >
        {isGood ? "-" : "+"}
        {Math.abs(pct).toFixed(0)}%
      </div>
    </div>
  );
}

function DealRow({ card }: { card: DealCard }) {
  const player = card.player;
  const auction = card.latestEnglishAuction!;
  const scores = [...player.so5Scores].reverse();
  const key = card.rarity.toUpperCase() as keyof typeof RARITY_COLORS;
  const color = RARITY_COLORS[key] || "#6b7280";
  const lightText = key === "SUPER_RARE" || key === "UNIQUE";

  return (
    <Card
      className="bg-card hover:border-primary/30 transition-colors"
      data-testid={`card-deal-${card.slug}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <PlayerAvatar name={player.displayName} rarity={card.rarity} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                style={{ backgroundColor: color, color: lightText ? "#fff" : "#000" }}
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
                    const c =
                      s.score >= 60 ? "#22c55e" : s.score >= 40 ? "#f5c518" : "#ef4444";
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

          <DiscountBadge pct={card.discountPct} />
        </div>

        <div className="mt-3 pt-3 border-t border-border/50 flex justify-between items-center text-xs">
          <span className="text-muted-foreground">
            Last sold {new Date(auction.endDate).toLocaleDateString()} ·{" "}
            <span className="text-muted-foreground/70">
              {card.rarity} avg: {formatEth(card.rarityAvgEth * 1e18)} ETH
            </span>
          </span>
          <span className="font-mono font-bold text-primary">
            {formatEth(auction.currentPrice)} ETH
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Deals() {
  const { data: popular, isLoading: loadingPop, error: errPop } = usePopularCards();
  const { data: rare, isLoading: loadingRare, error: errRare } = useRareCards();
  const { data: limited, isLoading: loadingLimited, error: errLimited } = useLimitedCards();

  const isLoading = loadingPop || loadingRare || loadingLimited;
  const error = errPop || errRare || errLimited;

  const { deals, rarityAvg } = useMemo(() => {
    // Pool all three card sources and de-duplicate
    const combined = [...(popular || []), ...(rare || []), ...(limited || [])];
    const seen = new Set<string>();
    const unique = combined.filter((c) => {
      if (seen.has(c.slug)) return false;
      seen.add(c.slug);
      return true;
    });

    // Compute average sale price per rarity tier
    const rarityPrices: Record<string, number[]> = {};
    for (const c of unique) {
      if (!c.latestEnglishAuction) continue;
      const p = parseFloat(c.latestEnglishAuction.currentPrice) / 1e18;
      if (!isNaN(p) && p > 0) {
        if (!rarityPrices[c.rarity]) rarityPrices[c.rarity] = [];
        rarityPrices[c.rarity].push(p);
      }
    }
    const rarityAvg: Record<string, number> = {};
    for (const [r, prices] of Object.entries(rarityPrices)) {
      rarityAvg[r] = prices.reduce((a, b) => a + b, 0) / prices.length;
    }

    const deals = unique
      .filter(
        (c) =>
          c.latestEnglishAuction &&
          c.player.averageScore != null &&
          c.player.averageScore > 0 &&
          rarityAvg[c.rarity] !== undefined
      )
      .map((c) => {
        const priceEth = parseFloat(c.latestEnglishAuction!.currentPrice) / 1e18;
        const avg = rarityAvg[c.rarity];
        const discountPct = ((avg - priceEth) / avg) * 100;
        return { ...c, priceEth, rarityAvgEth: avg, discountPct } as DealCard;
      })
      .filter((c) => c.priceEth > 0)
      .sort((a, b) => b.discountPct - a.discountPct);

    return { deals, rarityAvg };
  }, [popular, rare, limited]);

  const belowAvg = deals.filter((d) => d.discountPct > 0);
  const aboveAvg = deals.filter((d) => d.discountPct <= 0);

  return (
    <div className="space-y-6" data-testid="page-deals">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Deal Finder</h2>
        <p className="text-muted-foreground mt-1">
          Cards with last sale price below the recent average for their rarity tier — potential
          value picks ranked by discount.
        </p>
      </div>

      {/* Methodology note */}
      <div className="flex gap-3 p-3 bg-muted/20 border border-border/40 rounded-lg text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Average price is computed across all sampled cards of the same rarity. Cards priced{" "}
          <span className="text-green-400 font-medium">below average</span> are deals;{" "}
          <span className="text-red-400 font-medium">above average</span> are overpriced.
          {Object.keys(rarityAvg).length > 0 && (
            <span className="ml-1">
              Averages:{" "}
              {Object.entries(rarityAvg)
                .sort((a, b) => b[1] - a[1])
                .map(([r, avg]) => `${r.replace("_", " ")}: ${formatEth(avg * 1e18)} ETH`)
                .join(" · ")}
            </span>
          )}
        </span>
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
                  <Skeleton className="w-12 h-14 rounded shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="w-20 h-14 rounded-lg shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div className="text-center p-12 bg-card rounded-lg border border-border text-muted-foreground">
          No cards with price data found right now. Try refreshing.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Below-average: best deals */}
          {belowAvg.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-green-400" />
                <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wide">
                  Below Rarity Average — Potential Deals ({belowAvg.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {belowAvg.map((deal) => (
                  <DealRow key={deal.slug} card={deal} />
                ))}
              </div>
            </div>
          )}

          {/* Above-average: pricier cards */}
          {aboveAvg.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Above Rarity Average ({aboveAvg.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aboveAvg.slice(0, 10).map((deal) => (
                  <DealRow key={deal.slug} card={deal} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
