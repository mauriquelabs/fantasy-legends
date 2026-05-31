import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useWCSquad,
  useAddPlayer,
  useRemovePlayer,
  useSorareSearch,
  type SquadPlayer,
  type SorareCandidate,
} from "@/hooks/useWorldCup";
import { WORLD_CUP_2026_TEAMS, CONFEDERATION_COLORS, type WCTeam } from "@/data/world-cup-2026";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Globe, ExternalLink, ChevronLeft, Plus, X } from "lucide-react";
import { POSITION_ORDER, POSITION_LABEL, ScoreBar, AvgBadge } from "@/components/squad-shared";

// ── Player detail dialog ──────────────────────────────────────────────────────

function ScoreBarsDetailed({ scores }: { scores: number[] }) {
  if (!scores.length) return <p className="text-xs text-muted-foreground italic">No recent scores</p>;
  return (
    <div className="flex items-end gap-3">
      {scores.map((s, i) => {
        const color = s >= 60 ? "#22c55e" : s >= 40 ? "#f5c518" : "#ef4444";
        const h = Math.max(6, Math.round((s / 100) * 56));
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-mono text-muted-foreground">{s.toFixed(0)}</span>
            <div className="w-7 rounded" style={{ height: h, backgroundColor: color }} />
          </div>
        );
      })}
    </div>
  );
}

function PlayerDetailDialog({
  player,
  teamSlug,
  open,
  onClose,
}: {
  player: SquadPlayer;
  teamSlug: string;
  open: boolean;
  onClose: () => void;
}) {
  const remove = useRemovePlayer(teamSlug);
  const sorare = player.sorare;

  async function handleRemove() {
    if (!window.confirm(`Remove "${player.name}" from the squad?`)) return;
    await remove.mutateAsync({ sorareSlug: player.sorareSlug });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">{player.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">{player.position}</p>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {sorare ? (
            <>
              {sorare.currentClub && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Club</span>
                  <span className="text-sm font-medium">{sorare.currentClub}</span>
                </div>
              )}
              {sorare.avgScore != null && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Avg score</span>
                  <div className="flex items-center gap-2">
                    <AvgBadge score={sorare.avgScore} />
                    <span className="text-sm text-muted-foreground">(last 15)</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Recent SO5 scores</p>
                <ScoreBarsDetailed scores={sorare.recentScores} />
              </div>
              <div className="flex items-center justify-between border-t border-border/40 pt-3">
                <button
                  onClick={handleRemove}
                  disabled={remove.isPending}
                  className="text-[11px] text-muted-foreground/50 hover:text-destructive transition-colors disabled:opacity-40"
                >
                  Remove from squad
                </button>
                <a
                  href={`https://sorare.com/football/players/${player.sorareSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  View on Sorare <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">No Sorare stats available yet.</p>
              <div className="flex items-center justify-between">
                <button
                  onClick={handleRemove}
                  disabled={remove.isPending}
                  className="text-[11px] text-muted-foreground/50 hover:text-destructive transition-colors disabled:opacity-40"
                >
                  Remove from squad
                </button>
                <a
                  href={`https://sorare.com/football/players/${player.sorareSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  View on Sorare <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add player dialog ─────────────────────────────────────────────────────────

function AddPlayerDialog({
  teamSlug,
  open,
  onClose,
}: {
  teamSlug: string;
  open: boolean;
  onClose: () => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState<string | null>(null);
  const [manualSlug, setManualSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: searchData, isLoading: searchLoading } = useSorareSearch(activeSearch);
  const add = useAddPlayer(teamSlug);

  async function handleAdd(slug: string) {
    setError(null);
    try {
      await add.mutateAsync({ sorareSlug: slug });
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Failed to add player");
    }
  }

  function triggerSearch() {
    const q = searchInput.trim();
    if (q.length >= 2) setActiveSearch(q);
  }

  const results: SorareCandidate[] = searchData?.results ?? [];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Add Player to Squad</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>
          )}

          {/* Name search */}
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Search by name</p>
            <div className="flex gap-2">
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && triggerSearch()}
                placeholder="Player name…"
                className="flex-1 bg-muted/20 border border-border/50 rounded px-2.5 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60"
              />
              <button
                onClick={triggerSearch}
                disabled={searchInput.trim().length < 2 || searchLoading}
                className="px-3 py-1.5 rounded bg-muted/30 text-sm font-medium disabled:opacity-40 hover:bg-muted/50 transition-colors"
              >
                {searchLoading ? "…" : "Search"}
              </button>
            </div>

            {results.length > 0 && (
              <div className="space-y-1 pt-1">
                {results.map(c => (
                  <button
                    key={c.slug}
                    onClick={() => handleAdd(c.slug)}
                    disabled={add.isPending}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded border border-border/50 bg-muted/10 hover:bg-muted/30 hover:border-primary/40 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.displayName}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{c.slug}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {activeSearch && !searchLoading && results.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No results — try the full name or use the slug below</p>
            )}
          </div>

          {/* Manual slug */}
          <div className="space-y-1.5 border-t border-border/40 pt-3">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Enter Sorare slug</p>
            <div className="flex gap-2">
              <input
                value={manualSlug}
                onChange={e => setManualSlug(e.target.value)}
                placeholder="e.g. kylian-mbappe-lottin"
                className="flex-1 bg-muted/20 border border-border/50 rounded px-2.5 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60"
              />
              <button
                onClick={() => manualSlug.trim() && handleAdd(manualSlug.trim())}
                disabled={!manualSlug.trim() || add.isPending}
                className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Individual player row ─────────────────────────────────────────────────────

function PlayerRow({ player, onView }: {
  player: SquadPlayer;
  onView: (p: SquadPlayer) => void;
}) {
  const hasLiveData = player.sorare != null;
  const club = player.sorare?.currentClub ?? null;

  return (
    <div
      onClick={() => onView(player)}
      className="flex items-center gap-3 px-3 py-2.5 rounded bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer"
    >
      {/* Name + club */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate flex items-center gap-1.5">
          {player.name}
          {player.addedManually && (
            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 uppercase tracking-wide">
              Manual
            </span>
          )}
        </div>
        {club && <div className="text-[11px] text-muted-foreground truncate">{club}</div>}
      </div>

      {/* Sorare stats */}
      {hasLiveData && (
        <div className="flex items-center gap-2 shrink-0">
          <ScoreBar scores={player.sorare!.recentScores} />
          {player.sorare!.avgScore !== null && <AvgBadge score={player.sorare!.avgScore} />}
        </div>
      )}
    </div>
  );
}

// ── Squad view ────────────────────────────────────────────────────────────────

function SquadView({ team }: { team: WCTeam }) {
  const { data, isLoading, error } = useWCSquad(team.slug);
  const [viewing, setViewing] = useState<SquadPlayer | null>(null);
  const [addingPlayer, setAddingPlayer] = useState(false);

  const grouped = useMemo(() => {
    if (!data) return null;
    const map = new Map<string, SquadPlayer[]>();
    for (const pos of POSITION_ORDER) map.set(pos, []);
    for (const p of data.players) {
      const key = POSITION_ORDER.includes(p.position as any) ? p.position : "Offence";
      map.get(key)!.push(p);
    }
    for (const [, players] of map) {
      players.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [data]);

  const sorareCount = data?.players.filter(p => p.sorare != null).length ?? 0;

  if (error) {
    return (
      <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded px-4 py-3">
        {error instanceof Error ? error.message : "Failed to load squad"}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{team.flag}</span>
          <div>
            <h3 className="text-xl font-bold">{data?.teamName ?? team.name}</h3>
            {data && (
              <p className="text-xs text-muted-foreground">
                {data.players.length} players · {sorareCount} with Sorare data
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setAddingPlayer(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border/50 bg-muted/10 hover:bg-muted/30 text-sm font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Player
        </button>
      </div>

      {/* Legend */}
      {data && (
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-green-500/60" /> ≥ 60 avg</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-yellow-500/60" /> 45–59</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-orange-500/60" /> 30–44</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-500/60" /> &lt; 30</span>
        </div>
      )}

      {/* Position groups */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
        </div>
      ) : grouped ? (
        <div className="space-y-6">
          {POSITION_ORDER.map(pos => {
            const players = grouped.get(pos) ?? [];
            if (!players.length) return null;
            return (
              <div key={pos}>
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  {POSITION_LABEL[pos]} ({players.length})
                </h4>
                <div className="space-y-1">
                  {players.map(p => <PlayerRow key={p.name} player={p} onView={setViewing} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {viewing && (
        <PlayerDetailDialog
          player={viewing}
          teamSlug={team.slug}
          open={true}
          onClose={() => setViewing(null)}
        />
      )}
      {addingPlayer && (
        <AddPlayerDialog teamSlug={team.slug} open={true} onClose={() => setAddingPlayer(false)} />
      )}
    </div>
  );
}

// ── Team selector ─────────────────────────────────────────────────────────────

type ConfederationFilter = WCTeam["confederation"] | "ALL";

function TeamSelector({ onSelect }: { onSelect: (team: WCTeam) => void }) {
  const [confederation, setConfederation] = useState<ConfederationFilter>("ALL");
  const confederations: ConfederationFilter[] = ["ALL", "UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC"];

  const filtered = confederation === "ALL"
    ? WORLD_CUP_2026_TEAMS
    : WORLD_CUP_2026_TEAMS.filter(t => t.confederation === confederation);

  return (
    <div className="space-y-4">
      {/* Confederation filter */}
      <div className="flex flex-wrap gap-1.5">
        {confederations.map(c => (
          <button
            key={c}
            onClick={() => setConfederation(c)}
            className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide border transition-colors ${
              confederation === c
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/20 text-muted-foreground border-border/50 hover:bg-muted/40"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Team grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {filtered.map(team => {
          const confColor = CONFEDERATION_COLORS[team.confederation];
          return (
            <button
              key={team.slug}
              onClick={() => onSelect(team)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/20 hover:border-primary/40 cursor-pointer text-center transition-all"
              title={team.name}
            >
              <span className="text-2xl leading-none">{team.flag}</span>
              <span className="text-[11px] font-semibold leading-tight">{team.name}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${confColor}`}>
                {team.confederation}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorldCup() {
  const [, params] = useRoute<{ slug: string }>("/world-cup/squads/:slug");
  const [, navigate] = useLocation();

  const selected: WCTeam | null = params?.slug
    ? (WORLD_CUP_2026_TEAMS.find(t => t.slug === params.slug) ?? null)
    : null;

  function handleSelect(team: WCTeam) {
    navigate(`/world-cup/squads/${team.slug}`);
  }

  function handleBack() {
    navigate("/world-cup/squads");
  }

  return (
    <div className="space-y-6" data-testid="page-world-cup">
      <div className="flex items-center gap-3">
        {selected && (
          <button
            onClick={handleBack}
            className="p-1.5 rounded hover:bg-muted/30 text-muted-foreground transition-colors"
            aria-label="Back to team list"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" />
            <h2 className="text-3xl font-bold tracking-tight">World Cup 2026</h2>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            {selected
              ? "Squad list — Sorare data shown where available"
              : "Select a team to view their squad and Sorare stats"}
          </p>
        </div>
      </div>

      {selected ? (
        <Card className="bg-card">
          <CardContent className="p-5">
            <SquadView team={selected} />
          </CardContent>
        </Card>
      ) : (
        <TeamSelector onSelect={handleSelect} />
      )}
    </div>
  );
}
