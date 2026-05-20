import { useState, useEffect, useMemo } from "react";
import { usePopularCards, useRareCards, useLimitedCards } from "@/hooks/useSorare";
import { formatEth, RARITY_COLORS } from "@/lib/sorare";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Info, Clock, TrendingDown } from "lucide-react";
import type { SorareCard } from "@/hooks/useSorare";

type Tab = "ending-soon" | "recent-sales";

// ── Countdown timer ──────────────────────────────────────────────────────────

function getTimeLeft(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function Countdown({ endDate }: { endDate: string }) {
  const [label, setLabel] = useState(() => getTimeLeft(endDate));
  useEffect(() => {
    const id = setInterval(() => setLabel(getTimeLeft(endDate)), 1000);
    return () => clearInterval(id);
  }, [endDate]);
  const isUrgent = (new Date(endDate).getTime() - Date.now()) < 3600000; // < 1h
  return (
    <span
      className={`font-mono font-bold tabular-nums ${
        isUrgent ? "text-red-400 animate-pulse" : "text-amber-400"
      }`}
    >
      {label}
    </span>
  );
}

function timeAgo(endDate: string): string {
  const diff = Date.now() - new Date(endDate).getTime();
  if (diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${m}m ago`;
}

// ── Shared sub-components ────────────────────────────────────────────────────

function RarityBadge({ rarity }: { rarity: string }) {
  const key = rarity.toUpperCase() as keyof typeof RARITY_COLORS;
  const color = RARITY_COLORS[key] || "#6b7280";
  const light = key === "LIMITED" || key === "RARE";
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0"
      style={{ backgroundColor: color, color: light ? "#000" : "#fff" }}
    >
      {rarity.replace("_", " ")}
    </span>
  );
}

function ScoreBar({ scores }: { scores: { score: number }[] }) {
  if (!scores.length) return null;
  return (
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
  );
}

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
      className="w-10 h-12 rounded flex items-center justify-center shrink-0 font-black text-sm select-none"
      style={{ background: `linear-gradient(135deg, ${color}22, ${color}55)`, color }}
    >
      {initials}
    </div>
  );
}

// ── Live Auction Card ─────────────────────────────────────────────────────────

function LiveAuctionRow({ card }: { card: SorareCard }) {
  const player = card.player;
  const auction = card.latestEnglishAuction!;
  const scores = [...player.so5Scores].reverse();
  return (
    <Card
      className="bg-card border-amber-500/30 hover:border-amber-400/50 transition-colors"
      data-testid={`card-live-${card.slug}`}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <PlayerAvatar name={player.displayName} rarity={card.rarity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <RarityBadge rarity={card.rarity} />
            <span className="text-[10px] font-mono text-muted-foreground">#{card.serialNumber}</span>
          </div>
          <h3 className="font-bold text-sm truncate" data-testid={`text-player-live-${card.slug}`}>
            {player.displayName}
          </h3>
          <div className="text-xs text-muted-foreground truncate">
            {player.activeClub?.name || "Free agent"} · {player.position}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <ScoreBar scores={scores} />
            {player.averageScore != null && (
              <span className="text-xs font-mono text-primary font-bold">
                {player.averageScore.toFixed(0)} avg
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right space-y-1">
          <div className="flex items-center gap-1 justify-end text-[10px] text-amber-400 font-bold uppercase tracking-wide">
            <Clock className="w-3 h-3" />
            <Countdown endDate={auction.endDate} />
          </div>
          <div className="text-sm font-mono font-bold text-primary">
            {formatEth(auction.currentPrice)} ETH
          </div>
          <div className="text-[10px] text-muted-foreground">
            min bid: {formatEth(auction.minNextBid)} ETH
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Recent Sale Card ──────────────────────────────────────────────────────────

function RecentSaleRow({ card }: { card: SorareCard }) {
  const player = card.player;
  const auction = card.latestEnglishAuction!;
  const scores = [...player.so5Scores].reverse();
  return (
    <Card
      className="bg-card hover:border-primary/30 transition-colors"
      data-testid={`card-sale-${card.slug}`}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <PlayerAvatar name={player.displayName} rarity={card.rarity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <RarityBadge rarity={card.rarity} />
            <span className="text-[10px] font-mono text-muted-foreground">#{card.serialNumber}</span>
          </div>
          <h3 className="font-bold text-sm truncate" data-testid={`text-player-sale-${card.slug}`}>
            {player.displayName}
          </h3>
          <div className="text-xs text-muted-foreground truncate">
            {player.activeClub?.name || "Free agent"} · {player.position}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <ScoreBar scores={scores} />
            {player.averageScore != null && (
              <span className="text-xs font-mono text-primary font-bold">
                {player.averageScore.toFixed(0)} avg
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right space-y-0.5">
          <div className="text-[10px] text-muted-foreground">
            {timeAgo(auction.endDate)}
          </div>
          <div className="text-sm font-mono font-bold text-primary">
            {formatEth(auction.currentPrice)} ETH
          </div>
          <div className="text-[10px] text-muted-foreground">
            {new Date(auction.endDate).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="bg-card">
          <CardContent className="p-4 flex items-center gap-4">
            <Skeleton className="w-10 h-12 rounded shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="w-20 h-12 rounded shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Auctions() {
  const [tab, setTab] = useState<Tab>("ending-soon");
  const { data: popular, isLoading: loadingPop, error: errPop } = usePopularCards();
  const { data: rare, isLoading: loadingRare, error: errRare } = useRareCards();
  const { data: limited, isLoading: loadingLimited, error: errLimited } = useLimitedCards();

  const isLoading = loadingPop || loadingRare || loadingLimited;
  const error = errPop || errRare || errLimited;

  // Merge all three card pools and de-duplicate by slug
  const allCards = useMemo(() => {
    const combined = [...(popular || []), ...(rare || []), ...(limited || [])];
    const seen = new Set<string>();
    return combined.filter((c) => {
      if (seen.has(c.slug)) return false;
      seen.add(c.slug);
      return true;
    });
  }, [popular, rare, limited]);

  // Live auctions: endDate in the future → sort soonest-ending first
  const liveAuctions = useMemo(() => {
    const now = Date.now();
    return allCards
      .filter(
        (c) =>
          c.latestEnglishAuction &&
          new Date(c.latestEnglishAuction.endDate).getTime() > now
      )
      .sort(
        (a, b) =>
          new Date(a.latestEnglishAuction!.endDate).getTime() -
          new Date(b.latestEnglishAuction!.endDate).getTime()
      );
  }, [allCards]);

  // Recent sales: endDate in the past → sort most-recently-sold first
  const recentSales = useMemo(() => {
    const now = Date.now();
    return allCards
      .filter(
        (c) =>
          c.latestEnglishAuction &&
          new Date(c.latestEnglishAuction.endDate).getTime() < now
      )
      .sort(
        (a, b) =>
          new Date(b.latestEnglishAuction!.endDate).getTime() -
          new Date(a.latestEnglishAuction!.endDate).getTime()
      );
  }, [allCards]);

  const tabs = [
    {
      key: "ending-soon" as Tab,
      label: "Ending Soon",
      count: liveAuctions.length,
    },
    {
      key: "recent-sales" as Tab,
      label: "Recent Sales",
      count: recentSales.length,
    },
  ];

  return (
    <div className="space-y-5" data-testid="page-auctions">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Market Activity</h2>
        <p className="text-muted-foreground mt-1">
          Card auction data — live countdowns and completed sale prices from the Sorare market.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg w-fit">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${key}`}
          >
            {label}
            {!isLoading && count > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  tab === key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {error ? (
        <div className="text-destructive text-sm p-6 bg-card rounded-lg border border-destructive/30">
          {(error as Error).message}
        </div>
      ) : isLoading ? (
        <LoadingRows />
      ) : tab === "ending-soon" ? (
        liveAuctions.length === 0 ? (
          <div className="space-y-4">
            <div className="flex gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-amber-300 font-medium">
                  Live auction visibility requires Sorare authentication
                </p>
                <p className="text-amber-400/70 text-xs">
                  The Sorare public API does not expose active auction listings to unauthenticated
                  requests. No cards with a future auction end date were found in the current
                  dataset ({allCards.length} cards sampled). View "Recent Sales" for completed
                  market data, or visit{" "}
                  <a
                    href="https://sorare.com/football/market"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-amber-300"
                  >
                    sorare.com/football/market
                  </a>{" "}
                  for live listings.
                </p>
              </div>
            </div>
            {/* Show all cards with auctions sorted by endDate desc as a reference */}
            {recentSales.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  Showing most recently completed auctions from the sampled card pool
                </p>
                <div className="space-y-3">
                  {recentSales.slice(0, 8).map((card) => (
                    <RecentSaleRow key={card.slug} card={card} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {liveAuctions.map((card) => (
              <LiveAuctionRow key={card.slug} card={card} />
            ))}
          </div>
        )
      ) : (
        /* Recent Sales tab */
        recentSales.length === 0 ? (
          <div className="text-center p-12 bg-card rounded-lg border border-border text-muted-foreground">
            No recently completed sales found in the current sample.
          </div>
        ) : (
          <div className="space-y-3" data-testid="recent-sales-list">
            {recentSales.map((card) => (
              <RecentSaleRow key={card.slug} card={card} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
