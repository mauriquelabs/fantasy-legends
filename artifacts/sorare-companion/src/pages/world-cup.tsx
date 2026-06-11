import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useWCTeams,
  useWCSquad,
  useRemovePlayer,
  useRestorePlayer,
  type WCTeamRef,
  type SquadPlayer,
} from "@/hooks/useWorldCup";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Globe, ChevronLeft, ChevronDown } from "lucide-react";
import { POSITION_ORDER, POSITION_LABEL, PlayerRow, PlayerDetailDialog } from "@/components/squad-shared";

// ── Squad view ────────────────────────────────────────────────────────────────

function SquadView({ team }: { team: WCTeamRef }) {
  const { data, isLoading, error } = useWCSquad(team.slug);
  const [viewing, setViewing] = useState<SquadPlayer | null>(null);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const { toast } = useToast();
  const remove = useRemovePlayer(team.slug, {
    onSuccess: (_, playerSlug) => {
      const name = data?.players.find(p => p.sorareSlug === playerSlug)?.name ?? "Player";
      toast({ title: `${name} deactivated`, description: "They've been moved to the 'Not in squad' section." });
    },
    onError: () => toast({ title: "Failed to deactivate", variant: "destructive" }),
  });
  const restore = useRestorePlayer(team.slug, {
    onSuccess: (_, playerSlug) => {
      const name = data?.players.find(p => p.sorareSlug === playerSlug)?.name ?? "Player";
      toast({ title: `${name} restored`, description: "They're back in the active squad." });
    },
    onError: () => toast({ title: "Failed to restore", variant: "destructive" }),
  });

  const { grouped, deactivated } = useMemo(() => {
    if (!data) return { grouped: null, deactivated: [] };
    const map = new Map<string, SquadPlayer[]>();
    for (const pos of POSITION_ORDER) map.set(pos, []);
    const inactive: SquadPlayer[] = [];
    for (const p of data.players) {
      if (!p.active) { inactive.push(p); continue; }
      const key = POSITION_ORDER.includes(p.position as any) ? p.position : "Offence";
      map.get(key)!.push(p);
    }
    for (const [, players] of map) players.sort((a, b) => a.name.localeCompare(b.name));
    inactive.sort((a, b) => a.name.localeCompare(b.name));
    return { grouped: map, deactivated: inactive };
  }, [data]);

  const activePlayers = data?.players.filter(p => p.active) ?? [];
  const sorareCount = activePlayers.filter(p => p.sorare != null).length;

  if (error) {
    return (
      <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded px-4 py-3">
        {error instanceof Error ? error.message : "Failed to load squad"}
      </div>
    );
  }

  function playerDialogProps(p: SquadPlayer) {
    return {
      sorareSlug: p.sorareSlug,
      name: p.name,
      position: p.position,
      club: p.sorare?.currentClub ?? null,
      avgScore: p.sorare?.avgScore ?? null,
      recentScores: p.sorare?.recentScores ?? [],
    };
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        {team.pictureUrl && <img src={team.pictureUrl} alt={team.name} className="w-10 h-10 object-contain" />}
        <div>
          <h3 className="text-xl font-bold">{data?.teamName ?? team.name}</h3>
          {data && (
            <p className="text-xs text-muted-foreground">
              {activePlayers.length} players
            </p>
          )}
        </div>
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
                <Card className="bg-card">
                  <CardContent className="p-0">
                    {players.map(p => (
                      <PlayerRow
                        key={p.sorareSlug}
                        player={{
                          name: p.name,
                          position: p.position,
                          teamName: p.sorare?.currentClub ?? null,
                          score: p.sorare?.avgScore ?? null,
                          recentScores: p.sorare?.recentScores ?? null,
                          sorareSlug: p.sorare ? p.sorareSlug : null,
                          badge: p.addedManually ? (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 uppercase tracking-wide">
                              Manual
                            </span>
                          ) : undefined,
                          onDeactivate: () => remove.mutate(p.sorareSlug),
                        }}
                        onClick={() => setViewing(p)}
                      />
                    ))}
                  </CardContent>
                </Card>
              </div>
            );
          })}

          {/* Deactivated section */}
          {deactivated.length > 0 && (
            <div>
              <button
                onClick={() => setShowDeactivated(v => !v)}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors mb-2"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDeactivated ? "" : "-rotate-90"}`} />
                Not in squad ({deactivated.length})
              </button>
              {showDeactivated && (
                <Card className="bg-card opacity-60">
                  <CardContent className="p-0">
                    {deactivated.map(p => (
                      <PlayerRow
                        key={p.sorareSlug}
                        player={{
                          name: p.name,
                          position: p.position,
                          teamName: p.sorare?.currentClub ?? null,
                          score: p.sorare?.avgScore ?? null,
                          recentScores: p.sorare?.recentScores ?? null,
                          sorareSlug: p.sorare ? p.sorareSlug : null,
                          onRestore: () => restore.mutate(p.sorareSlug),
                        }}
                        onClick={() => setViewing(p)}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      ) : null}

      {viewing && (
        <PlayerDetailDialog
          player={playerDialogProps(viewing)}
          open={true}
          onClose={() => setViewing(null)}
          onRemove={viewing.active ? () => remove.mutateAsync(viewing.sorareSlug) : undefined}
          onRestore={!viewing.active ? () => restore.mutateAsync(viewing.sorareSlug) : undefined}
        />
      )}
    </div>
  );
}

// ── Team selector ─────────────────────────────────────────────────────────────

function TeamSelector({
  teams,
  isLoading,
  onSelect,
}: {
  teams: WCTeamRef[];
  isLoading: boolean;
  onSelect: (team: WCTeamRef) => void;
}) {
  return isLoading ? (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="h-20 rounded-lg border border-border/30 bg-muted/10 animate-pulse" />
      ))}
    </div>
  ) : (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
      {teams.map(team => (
        <button
          key={team.slug}
          onClick={() => onSelect(team)}
          className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/20 hover:border-primary/40 cursor-pointer text-center transition-all"
          title={team.name}
        >
          {team.pictureUrl
            ? <img src={team.pictureUrl} alt={team.name} className="w-8 h-8 object-contain" />
            : <div className="w-8 h-8 rounded-full bg-muted/30" />
          }
          <span className="text-[11px] font-semibold leading-tight">{team.name}</span>
        </button>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorldCup() {
  const [, params] = useRoute<{ slug: string }>("/world-cup/squads/:slug");
  const [, navigate] = useLocation();

  const { data: teamsData, isLoading: teamsLoading } = useWCTeams();
  const teams = teamsData?.teams ?? [];
  const isOnSquadPage = Boolean(params?.slug);

  const selected: WCTeamRef | null = isOnSquadPage
    ? (teams.find(t => t.slug === params!.slug) ?? null)
    : null;

  function handleSelect(team: WCTeamRef) {
    navigate(`/world-cup/squads/${team.slug}`);
  }

  function handleBack() {
    navigate("/world-cup/squads");
  }

  const showSquad = isOnSquadPage && !teamsLoading && selected;

  return (
    <div className="space-y-6" data-testid="page-world-cup">
      <div className="flex items-center gap-3">
        {isOnSquadPage && (
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
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">World Cup 2026</h2>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isOnSquadPage
              ? "Squad list"
              : "Select a team to view their squad and Sorare stats"}
          </p>
        </div>
      </div>

      {isOnSquadPage && teamsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-muted/10 animate-pulse" />
          ))}
        </div>
      ) : showSquad ? (
        <Card className="bg-card">
          <CardContent className="p-5">
            <SquadView team={selected} />
          </CardContent>
        </Card>
      ) : (
        <TeamSelector teams={teams} isLoading={teamsLoading} onSelect={handleSelect} />
      )}
    </div>
  );
}
