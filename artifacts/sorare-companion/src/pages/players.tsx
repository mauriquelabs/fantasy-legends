import { useState, useMemo, useEffect } from "react";
import { CANONICAL_POSITIONS } from "@workspace/db/constants";
import { usePlayers } from "@/hooks/useApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check, ArrowUpDown } from "lucide-react";
import type { DbPlayer } from "@/hooks/useApi";
import { ScoreBar, AvgBadge, PlayerDetailDialog } from "@/components/squad-shared";

const PAGE_SIZE = 25;
const POSITIONS = ["All", ...CANONICAL_POSITIONS] as const;
type PositionFilter = (typeof POSITIONS)[number];

const SCORE_WINDOWS = [
  { value: "5", label: "Últimos 5" },
  { value: "15", label: "Últimos 15" },
  { value: "40", label: "Últimos 40" },
] as const;
type ScoreWindow = (typeof SCORE_WINDOWS)[number]["value"];

const SORT_OPTIONS = [
  { value: "score-desc", label: "Score ↓" },
  { value: "score-asc", label: "Score ↑" },
] as const;
type SortOption = (typeof SORT_OPTIONS)[number]["value"];

const POSITION_LABEL: Record<string, string> = {
  Goalkeeper: "GK",
  Defence: "DEF",
  Midfield: "MID",
  Offence: "FWD",
};

function getWindowScore(player: DbPlayer, window: ScoreWindow): number | null {
  if (window === "5") return player.avg5Score;
  if (window === "40") return player.avg40Score;
  return player.avgScore;
}

function PlayerRow({ player, window, onClick }: { player: DbPlayer; window: ScoreWindow; onClick: () => void }) {
  const parts = player.name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : player.name.slice(0, 2).toUpperCase();
  const posLabel = player.position ? (POSITION_LABEL[player.position] ?? player.position) : "—";
  const score = getWindowScore(player, window);

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors border-b border-border/40 last:border-0 cursor-pointer"
      data-testid={`row-player-${player.sorareSlug}`}
    >
      <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-sm font-black select-none shrink-0">
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm leading-tight truncate">{player.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {player.teamName ?? "—"}
          {player.nationality && player.nationality !== player.teamName && (
            <span className="text-muted-foreground/60"> · {player.nationality}</span>
          )}
        </div>
      </div>

      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground shrink-0">
        {posLabel}
      </span>

      {player.recentScores && player.recentScores.length > 0 && (
        <ScoreBar scores={player.recentScores} />
      )}
      {score != null && <AvgBadge score={score} />}
    </div>
  );
}

export default function Players() {
  const [selected, setSelected] = useState<DbPlayer | null>(null);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<PositionFilter>("All");
  const [team, setTeam] = useState("All");
  const [teamOpen, setTeamOpen] = useState(false);
  const [scoreWindow, setScoreWindow] = useState<ScoreWindow>("15");
  const [sort, setSort] = useState<SortOption>("score-desc");
  const [page, setPage] = useState(1);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading, error } = usePlayers(
    debouncedQuery || undefined,
    team !== "All" ? team : undefined,
  );

  // Stable teams list: only grows, never shrinks when a team filter is active.
  const [stableTeams, setStableTeams] = useState<{ name: string; slug: string }[]>([]);
  useEffect(() => {
    if (!data) return;
    setStableTeams(prev => {
      const known = new Set(prev.map(t => t.slug));
      const additions: { name: string; slug: string }[] = [];
      for (const p of data) {
        if (p.teamSlug && p.teamName && !known.has(p.teamSlug)) {
          known.add(p.teamSlug);
          additions.push({ name: p.teamName, slug: p.teamSlug });
        }
      }
      if (!additions.length) return prev;
      return [...prev, ...additions].sort((a, b) => a.name.localeCompare(b.name));
    });
  }, [data]);

  const filtered = useMemo(() => {
    const result = (data ?? []).filter((p) => {
      if (position !== "All" && p.position !== position) return false;
      return true;
    });

    return result.sort((a, b) => {
      const aScore = getWindowScore(a, scoreWindow) ?? -Infinity;
      const bScore = getWindowScore(b, scoreWindow) ?? -Infinity;
      return sort === "score-desc" ? bScore - aScore : aScore - bScore;
    });
  }, [data, position, scoreWindow, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = [
    position !== "All",
    team !== "All",
  ].filter(Boolean).length;

  return (
    <div className="space-y-6" data-testid="page-players">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Players</h2>
        <p className="text-muted-foreground mt-1">All players across the 48 World Cup squads.</p>
      </div>

      {/* Search + team + nationality */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-10 h-9 bg-card"
            placeholder="Filter by name or team…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="input-player-search"
          />
        </div>

        <Popover open={teamOpen} onOpenChange={setTeamOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={teamOpen}
              className="h-9 w-44 justify-between bg-card font-normal"
              data-testid="select-team"
            >
              <span className="truncate">{team === "All" ? "All teams" : (stableTeams.find(t => t.slug === team)?.name ?? team)}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search team…" />
              <CommandList>
                <CommandEmpty>No team found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="All" onSelect={() => { setTeam("All"); setPage(1); setTeamOpen(false); }}>
                    <Check className={cn("mr-2 h-4 w-4", team === "All" ? "opacity-100" : "opacity-0")} />
                    All teams
                  </CommandItem>
                  {stableTeams.map((t: { name: string; slug: string }) => (
                    <CommandItem key={t.slug} value={t.name} onSelect={() => { setTeam(t.slug); setPage(1); setTeamOpen(false); }}>
                      <Check className={cn("mr-2 h-4 w-4", team === t.slug ? "opacity-100" : "opacity-0")} />
                      {t.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

      </div>

      {/* Position + score window + sort */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-center">
        <div className="flex gap-1.5">
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => { setPosition(p); setPage(1); }}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${position === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              data-testid={`filter-${p.toLowerCase()}`}
            >
              {p === "All" ? "All" : POSITION_LABEL[p]}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-border/60 hidden sm:block" />

        <div className="flex gap-1.5">
          {SCORE_WINDOWS.map((w) => (
            <button
              key={w.value}
              onClick={() => { setScoreWindow(w.value); setPage(1); }}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${scoreWindow === w.value
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              data-testid={`window-${w.value}`}
            >
              {w.label}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-border/60 hidden sm:block" />

        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setSort(opt.value); setPage(1); }}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${sort === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              data-testid={`sort-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active</span>
          <button
            onClick={() => {
              setPosition("All");
              setTeam("All");
              setPage(1);
            }}
            className="text-xs text-primary hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {error ? (
        <div className="text-destructive text-sm p-4 bg-card rounded-lg border border-destructive/30">
          {(error as Error).message}
        </div>
      ) : isLoading ? (
        <Card className="bg-card">
          <CardContent className="p-0 divide-y divide-border/40">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-8 shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground text-sm p-8 text-center bg-card rounded-lg border border-border">
          {data?.length === 0
            ? "No players in the database yet. Run a sync first."
            : "No players match your filters."}
        </div>
      ) : (
        <Card className="bg-card">
          <CardContent className="p-0">
            {paginated.map((player) => (
              <PlayerRow key={player.sorareSlug} player={player} window={scoreWindow} onClick={() => setSelected(player)} />
            ))}
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length} players
            {filtered.length !== (data?.length ?? 0) && (
              <span className="text-muted-foreground/60"> ({data?.length ?? 0} total)</span>
            )}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {selected && (
        <PlayerDetailDialog
          player={{
            sorareSlug: selected.sorareSlug,
            name: selected.name,
            position: selected.position,
            club: selected.currentClub ?? null,
            avgScore: selected.avgScore,
            recentScores: selected.recentScores ?? [],
          }}
          open={true}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
