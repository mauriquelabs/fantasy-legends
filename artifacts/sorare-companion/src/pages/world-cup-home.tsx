import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Globe, ArrowRight, Bell, Sparkles, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useWCFixtures, type WCMatchTeam, type WCRound } from "@/hooks/useWorldCup";
import { usePlayers, type DbPlayer } from "@/hooks/useApi";
import { WORLD_CUP_2026_TEAMS } from "@/data/world-cup-2026";
import { TeamDetailDialog } from "@/pages/fixtures";
import { ScoreBar, AvgBadge, PlayerDetailDialog, avgScoreColor } from "@/components/squad-shared";

// ── Countdown ─────────────────────────────────────────────────────────────────

const KICKOFF = new Date("2026-06-11");

function Countdown() {
  const ms = KICKOFF.getTime() - Date.now();
  const days = ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 px-8 py-5 shrink-0">
      <span className="text-6xl font-black tabular-nums leading-none text-primary">{days}</span>
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground mt-2">days to kickoff</span>
    </div>
  );
}


// ── Group draw ────────────────────────────────────────────────────────────────

interface GroupEntry {
  key: string;
  label: string;
  teams: WCMatchTeam[];
}

type TeamClickHandler = (slug: string, name: string, crest?: string) => void;

function GroupCard({ group, onTeamClick }: { group: GroupEntry; onTeamClick: TeamClickHandler }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-3.5 space-y-2.5">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {group.label}
      </p>
      <div className="space-y-2">
        {group.teams.map(t => {
          const local = WORLD_CUP_2026_TEAMS.find(w => w.slug === t.sorareSlug);
          const flag = local ? (
            <span className="text-sm leading-none">{local.flag}</span>
          ) : t.crest ? (
            <img src={t.crest} alt="" className="w-4 h-4 object-contain shrink-0" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-muted/30 shrink-0" />
          );
          return t.sorareSlug ? (
            <button
              key={t.id}
              onClick={() => onTeamClick(t.sorareSlug!, t.name, t.crest)}
              className="flex items-center gap-2 w-full text-left hover:text-primary transition-colors group"
            >
              {flag}
              <span className="text-xs font-medium truncate group-hover:underline underline-offset-2">{t.name}</span>
            </button>
          ) : (
            <div key={t.id} className="flex items-center gap-2">
              {flag}
              <span className="text-xs font-medium truncate">{t.name}</span>
            </div>
          );
        })}
        {Array.from({ length: Math.max(0, 4 - group.teams.length) }).map((_, i) => (
          <div key={`tbd-${i}`} className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-muted/20 shrink-0" />
            <span className="text-xs text-muted-foreground/40">TBD</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/50 bg-card/60 p-3.5 space-y-2.5">
          <Skeleton className="h-3 w-10" />
          {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-4 w-full rounded" />)}
        </div>
      ))}
    </div>
  );
}

function ConfederationFallback() {
  const confs = useMemo(() => {
    const map = new Map<string, typeof WORLD_CUP_2026_TEAMS>();
    for (const t of WORLD_CUP_2026_TEAMS) {
      if (!map.has(t.confederation)) map.set(t.confederation, []);
      map.get(t.confederation)!.push(t);
    }
    return [...map.entries()];
  }, []);

  return (
    <div className="space-y-3">
      {confs.map(([conf, teams]) => (
        <div key={conf}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
            {conf} — {teams.length} teams
          </p>
          <div className="flex flex-wrap gap-1.5">
            {teams.map(t => (
              <span key={t.slug} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border/40 bg-card text-xs">
                <span className="text-sm leading-none">{t.flag}</span>
                <span className="font-medium">{t.name}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shared lookup ─────────────────────────────────────────────────────────────

const WC_TEAM_BY_SLUG = new Map(WORLD_CUP_2026_TEAMS.map(t => [t.slug, t]));

// ── Opening fixtures ──────────────────────────────────────────────────────────

function MatchCard({ match }: { match: ReturnType<typeof flattenMatches>[number] }) {
  const home = match.homeTeam;
  const away = match.awayTeam;
  const homeLocal = home?.sorareSlug ? WC_TEAM_BY_SLUG.get(home.sorareSlug) : null;
  const awayLocal = away?.sorareSlug ? WC_TEAM_BY_SLUG.get(away.sorareSlug) : null;

  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const isFinished = match.status === "FINISHED";
  const date = new Date(match.utcDate);
  const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-4 space-y-3">
      {match.group && (
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{match.group}</p>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {homeLocal ? (
            <span className="text-xl leading-none shrink-0">{homeLocal.flag}</span>
          ) : home?.crest ? (
            <img src={home.crest} alt="" className="w-5 h-5 object-contain shrink-0" />
          ) : <div className="w-5 h-5 rounded-full bg-muted/30 shrink-0" />}
          <span className="text-sm font-semibold truncate">{home?.name ?? "TBD"}</span>
        </div>

        <div className="shrink-0 min-w-[52px] text-center">
          {isLive && (
            <span className="text-[10px] font-bold text-red-400 bg-red-400/10 border border-red-400/30 px-1.5 py-0.5 rounded animate-pulse">LIVE</span>
          )}
          {isFinished ? (
            <span className="text-sm font-black tabular-nums">{match.homeScore} – {match.awayScore}</span>
          ) : !isLive && (
            <span className="text-xs text-muted-foreground font-medium tabular-nums">{timeStr}</span>
          )}
        </div>

        <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
          <span className="text-sm font-semibold truncate text-right">{away?.name ?? "TBD"}</span>
          {awayLocal ? (
            <span className="text-xl leading-none shrink-0">{awayLocal.flag}</span>
          ) : away?.crest ? (
            <img src={away.crest} alt="" className="w-5 h-5 object-contain shrink-0" />
          ) : <div className="w-5 h-5 rounded-full bg-muted/30 shrink-0" />}
        </div>
      </div>
    </div>
  );
}

function flattenMatches(rounds: WCRound[]) {
  return rounds.flatMap(r => r.matches);
}

function OpeningFixtures({ rounds, isLoading }: { rounds: WCRound[] | undefined; isLoading: boolean }) {
  const [, navigate] = useLocation();

  const firstMatches = useMemo(() => {
    if (!rounds) return [];
    return flattenMatches(rounds)
      .filter(m => m.homeTeam && m.awayTeam)
      .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
      .slice(0, 4);
  }, [rounds]);

  const dateLabel = firstMatches.length > 0
    ? new Date(firstMatches[0].utcDate).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })
    : null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Opening Day</h2>
          {dateLabel && (
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{dateLabel} · First group stage kicks off</p>
          )}
        </div>
        <button
          onClick={() => navigate("/world-cup/fixtures")}
          className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2"
        >
          Full schedule <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : firstMatches.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {firstMatches.map(m => <MatchCard key={m.id} match={m} />)}
        </div>
      ) : null}
    </section>
  );
}

// ── Players to watch ──────────────────────────────────────────────────────────

const POSITION_SHORT: Record<string, string> = {
  Goalkeeper: "GK",
  Defence: "DEF",
  Midfield: "MID",
  Offence: "FWD",
};

const POSITION_PILL: Record<string, string> = {
  Goalkeeper: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Defence: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Midfield: "bg-green-500/15 text-green-400 border-green-500/30",
  Offence: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

function PlayerWatchCard({ player, onClick }: { player: DbPlayer; onClick: () => void }) {
  const parts = player.name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : player.name.slice(0, 2).toUpperCase();
  const posLabel = player.position ? (POSITION_SHORT[player.position] ?? player.position) : "—";
  const posPill = player.position ? (POSITION_PILL[player.position] ?? "bg-muted/20 text-muted-foreground") : "bg-muted/20 text-muted-foreground";
  const flag = player.teamSlug ? WC_TEAM_BY_SLUG.get(player.teamSlug)?.flag : null;
  const scoreColor = player.avgScore != null ? avgScoreColor(player.avgScore) : "";

  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-xl border border-border/50 bg-card/60 p-4 text-left w-44 hover:border-primary/40 hover:bg-card transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/20 shrink-0"
    >
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-black select-none ${scoreColor || "bg-primary/10 border-primary/20 text-primary"}`}>
          {initials}
        </div>
        {player.avgScore != null && <AvgBadge score={player.avgScore} />}
      </div>

      <div className="space-y-0.5 min-w-0">
        <div className="font-semibold text-sm leading-tight flex items-center gap-1.5">
          {flag && <span className="text-base leading-none shrink-0">{flag}</span>}
          <span className="truncate">{player.name}</span>
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{player.currentClub ?? "—"}</div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${posPill}`}>{posLabel}</span>
        {player.recentScores && player.recentScores.length > 0 && (
          <ScoreBar scores={player.recentScores.slice(0, 5)} />
        )}
      </div>
    </button>
  );
}

function TopPlayersStrip({ onPlayerClick }: { onPlayerClick: (p: DbPlayer) => void }) {
  const [, navigate] = useLocation();
  const { data, isLoading } = usePlayers();

  const topPlayers = useMemo(() => {
    if (!data) return [];
    return [...data]
      .filter(p => p.avgScore != null)
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
      .slice(0, 8);
  }, [data]);

  if (!isLoading && topPlayers.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Players to Watch</h2>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">Top-rated WC players by Sorare avg score</p>
        </div>
        <button
          onClick={() => navigate("/world-cup/players")}
          className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2"
        >
          All players <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-44 rounded-xl shrink-0" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
          {topPlayers.map(p => (
            <div key={p.sorareSlug} className="snap-start">
              <PlayerWatchCard player={p} onClick={() => onPlayerClick(p)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Coming soon ───────────────────────────────────────────────────────────────

const COMING_SOON_ITEMS = [
  {
    icon: Sparkles,
    label: "Lineup Optimizer",
    description: "Auto-pick your best 5-player WC fantasy team. Weighs fixture difficulty, expected scores, and card availability.",
    accent: "from-emerald-500/10 border-emerald-500/20",
    iconBg: "bg-emerald-500/10 text-emerald-400",
  },
  {
    icon: Bell,
    label: "Price Alerts",
    description: "Track Sorare card prices for your WC targets. Get notified the moment they hit your budget.",
    accent: "from-pink-500/10 border-pink-500/20",
    iconBg: "bg-pink-500/10 text-pink-400",
  },
  {
    icon: Zap,
    label: "Live Score Feed",
    description: "Real-time SO5 score updates during WC match days, so you know exactly how your lineup is performing.",
    accent: "from-yellow-500/10 border-yellow-500/20",
    iconBg: "bg-yellow-500/10 text-yellow-400",
  },
] as const;

function ComingSoon() {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Coming Soon</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {COMING_SOON_ITEMS.map(f => (
          <div
            key={f.label}
            className={`relative flex flex-col gap-4 rounded-2xl border bg-gradient-to-b p-6 select-none ${f.accent}`}
          >
            <div className="flex items-start justify-between">
              <div className={`p-3 rounded-xl ${f.iconBg}`}>
                <f.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-muted/20 text-muted-foreground/60 border border-border/40">
                Soon
              </span>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold">{f.label}</h3>
              <p className="text-sm text-muted-foreground/70 leading-relaxed">{f.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WorldCupHome() {
  const { data: rounds, isLoading } = useWCFixtures();
  const [selectedTeam, setSelectedTeam] = useState<{ slug: string; name: string; crest?: string } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<DbPlayer | null>(null);

  const groups = useMemo<GroupEntry[] | null>(() => {
    if (!rounds) return null;
    const map = new Map<string, Map<number, WCMatchTeam>>();
    for (const round of rounds) {
      for (const match of round.matches) {
        if (!match.group) continue;
        if (!map.has(match.group)) map.set(match.group, new Map());
        const bucket = map.get(match.group)!;
        for (const t of [match.homeTeam, match.awayTeam]) {
          if (t) bucket.set(t.id, t);
        }
      }
    }
    if (map.size === 0) return null;
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, bucket]) => ({ key, label: key, teams: [...bucket.values()] }));
  }, [rounds]);

  return (
    <>
    <div className="min-h-screen bg-background text-foreground dark">
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-14">

        {/* Hero */}
        <div className="flex items-start justify-between gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Globe className="w-7 h-7 text-primary shrink-0" />
              <h1 className="text-4xl font-black tracking-tight">World Cup 2026</h1>
            </div>
            <p className="text-muted-foreground">USA · Canada · Mexico</p>
            <p className="text-sm text-muted-foreground/60">June 11 – July 19 · 48 teams · 12 groups · 104 matches</p>
          </div>
          <Countdown />
        </div>

        {/* Opening fixtures */}
        <OpeningFixtures rounds={rounds} isLoading={isLoading} />

        {/* Players to watch */}
        <TopPlayersStrip onPlayerClick={setSelectedPlayer} />

        {/* Group draw */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Group Draw</h2>
          {isLoading ? (
            <GroupsSkeleton />
          ) : groups ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {groups.map(g => <GroupCard key={g.key} group={g} onTeamClick={(slug, name, crest) => setSelectedTeam({ slug, name, crest })} />)}
            </div>
          ) : (
            <ConfederationFallback />
          )}
        </section>

        {/* Coming soon */}
        <ComingSoon />

      </div>
    </div>

    {selectedTeam && (
      <TeamDetailDialog
        slug={selectedTeam.slug}
        name={selectedTeam.name}
        crest={selectedTeam.crest}
        open={true}
        onClose={() => setSelectedTeam(null)}
      />
    )}

    {selectedPlayer && (
      <PlayerDetailDialog
        player={{
          sorareSlug: selectedPlayer.sorareSlug,
          name: selectedPlayer.name,
          position: selectedPlayer.position,
          club: selectedPlayer.currentClub ?? null,
          avgScore: selectedPlayer.avgScore,
          recentScores: selectedPlayer.recentScores ?? [],
        }}
        open={true}
        onClose={() => setSelectedPlayer(null)}
      />
    )}
    </>
  );
}
