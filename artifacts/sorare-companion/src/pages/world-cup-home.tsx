import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Globe, Users, Trophy, Search, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useWCFixtures, type WCMatchTeam } from "@/hooks/useWorldCup";
import { WORLD_CUP_2026_TEAMS } from "@/data/world-cup-2026";
import { TeamDetailDialog } from "@/pages/fixtures";

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

// ── Feature cards ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    href: "/world-cup/squads",
    icon: Users,
    label: "Squads",
    description: "Browse all 48 national team rosters. See which players are Sorare-registered and check their recent scores.",
    stat: "48 teams",
    accent: "from-blue-500/10 to-transparent border-blue-500/20 hover:border-blue-500/40",
    iconBg: "bg-blue-500/10 text-blue-400",
  },
  {
    href: "/world-cup/fixtures",
    icon: Trophy,
    label: "Fixtures",
    description: "Full match schedule across all 12 groups. Live scores and results as the tournament unfolds.",
    stat: "104 matches",
    accent: "from-yellow-500/10 to-transparent border-yellow-500/20 hover:border-yellow-500/40",
    iconBg: "bg-yellow-500/10 text-yellow-400",
  },
  {
    href: "/world-cup/players",
    icon: Search,
    label: "Players",
    description: "Find top-performing players across all squads. Filter by position and sort by Sorare average score.",
    stat: "Sorare-ready",
    accent: "from-purple-500/10 to-transparent border-purple-500/20 hover:border-purple-500/40",
    iconBg: "bg-purple-500/10 text-purple-400",
  },
] as const;

function FeatureCard({ feature }: { feature: typeof FEATURES[number] }) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate(feature.href)}
      className={`group flex flex-col gap-4 rounded-2xl border bg-gradient-to-b p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 ${feature.accent}`}
    >
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-xl ${feature.iconBg}`}>
          <feature.icon className="w-5 h-5" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/60 pt-1">
          {feature.stat}
        </span>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-lg font-bold">{feature.label}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
      </div>

      <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors mt-auto pt-2">
        Explore
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
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

// ── Page ──────────────────────────────────────────────────────────────────────

export function WorldCupHome() {
  const { data: rounds, isLoading } = useWCFixtures();
  const [selectedTeam, setSelectedTeam] = useState<{ slug: string; name: string; crest?: string } | null>(null);

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

        {/* Feature cards */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Explore</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {FEATURES.map(f => <FeatureCard key={f.href} feature={f} />)}
          </div>
        </section>

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
    </>
  );
}
