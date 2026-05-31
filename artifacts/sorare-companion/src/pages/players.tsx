import { useState, useMemo, useEffect } from "react";
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
import { Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check } from "lucide-react";
import type { DbPlayer } from "@/hooks/useApi";

const PAGE_SIZE = 25;
const POSITIONS = ["All", "Goalkeeper", "Defence", "Midfield", "Offence"] as const;
type PositionFilter = (typeof POSITIONS)[number];

const POSITION_LABEL: Record<string, string> = {
  Goalkeeper: "GK",
  Defence: "DEF",
  Midfield: "MID",
  Offence: "FWD",
};

function PlayerRow({ player }: { player: DbPlayer }) {
  const parts = player.name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : player.name.slice(0, 2).toUpperCase();
  const posLabel = player.position ? (POSITION_LABEL[player.position] ?? player.position) : "—";

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/10 transition-colors border-b border-border/40 last:border-0"
      data-testid={`row-player-${player.sorareSlug}`}
    >
      <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-sm font-black select-none shrink-0">
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm leading-tight truncate">{player.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {player.teamName ?? "—"}
        </div>
      </div>

      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground shrink-0">
        {posLabel}
      </span>
    </div>
  );
}

export default function Players() {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<PositionFilter>("All");
  const [team, setTeam] = useState("All");
  const [teamOpen, setTeamOpen] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = usePlayers();

  const teams = useMemo(() => {
    if (!data) return [];
    const names = [...new Set(data.map((p) => p.teamName).filter(Boolean) as string[])];
    return names.sort();
  }, [data]);

  const filtered = useMemo(
    () =>
      (data ?? []).filter((p) => {
        if (position !== "All" && p.position !== position) return false;
        if (team !== "All" && p.teamName !== team) return false;
        if (query.trim().length > 0) {
          const q = query.toLowerCase();
          if (!p.name.toLowerCase().includes(q) && !p.teamName?.toLowerCase().includes(q))
            return false;
        }
        return true;
      }),
    [data, position, team, query],
  );

  useEffect(() => {
    setPage(1);
  }, [query, position, team]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6" data-testid="page-players">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Players</h2>
        <p className="text-muted-foreground mt-1">All players across the 48 World Cup squads.</p>
      </div>

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
              className="h-9 w-48 justify-between bg-card font-normal"
              data-testid="select-team"
            >
              <span className="truncate">{team === "All" ? "All teams" : team}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search team…" />
              <CommandList>
                <CommandEmpty>No team found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="All" onSelect={() => { setTeam("All"); setTeamOpen(false); }}>
                    <Check className={cn("mr-2 h-4 w-4", team === "All" ? "opacity-100" : "opacity-0")} />
                    All teams
                  </CommandItem>
                  {teams.map((t) => (
                    <CommandItem key={t} value={t} onSelect={() => { setTeam(t); setTeamOpen(false); }}>
                      <Check className={cn("mr-2 h-4 w-4", team === t ? "opacity-100" : "opacity-0")} />
                      {t}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="flex gap-1.5">
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPosition(p)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                position === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
              data-testid={`filter-${p.toLowerCase()}`}
            >
              {p === "All" ? "All" : POSITION_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

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
              <PlayerRow key={player.sorareSlug} player={player} />
            ))}
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="flex items-center justify-between">
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
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
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
    </div>
  );
}
