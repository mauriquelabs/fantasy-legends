import { useState, useMemo } from "react";
import { useWCTeams, useWCSquad, useSorareCandidates, useSorareSearch, useLinkPlayer, useHidePlayer, type WCTeamRef, type SquadPlayer, type SorareCandidate } from "@/hooks/useWorldCup";
import { WORLD_CUP_2026_TEAMS, CONFEDERATION_COLORS, type WCTeam } from "@/data/world-cup-2026";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Globe, ExternalLink, ChevronLeft, Link2 } from "lucide-react";

// ── Utilities ─────────────────────────────────────────────────────────────────

const POSITION_ORDER = ["Goalkeeper", "Defence", "Midfield", "Offence"] as const;
const POSITION_LABEL: Record<string, string> = {
  Goalkeeper: "Goalkeepers",
  Defence: "Defenders",
  Midfield: "Midfielders",
  Offence: "Forwards",
};

function calcAge(dob: string | null): string {
  if (!dob) return "—";
  const diff = Date.now() - new Date(dob).getTime();
  return String(Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Match a football-data.org team to our static WC list by name similarity
function matchStaticTeam(fdTeam: WCTeamRef): WCTeam | undefined {
  const fdNorm = normalize(fdTeam.name);
  return WORLD_CUP_2026_TEAMS.find(t => {
    const tNorm = normalize(t.name);
    return tNorm === fdNorm || fdNorm.includes(tNorm) || tNorm.includes(fdNorm);
  });
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ scores }: { scores: number[] }) {
  if (!scores.length) return null;
  return (
    <div className="flex items-end gap-0.5 h-4">
      {scores.map((s, i) => {
        const h = Math.max(2, Math.round((s / 100) * 16));
        const c = s >= 60 ? "#22c55e" : s >= 40 ? "#f5c518" : "#ef4444";
        return <div key={i} className="w-1.5 rounded-sm" style={{ height: h, backgroundColor: c }} />;
      })}
    </div>
  );
}

// ── Avg score badge ───────────────────────────────────────────────────────────

function AvgBadge({ score }: { score: number }) {
  const color =
    score >= 60 ? "bg-green-500/15 text-green-400 border-green-500/30" :
    score >= 45 ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" :
    score >= 30 ? "bg-orange-500/15 text-orange-400 border-orange-500/30" :
                  "bg-red-500/15 text-red-400 border-red-500/30";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold tabular-nums ${color}`}>
      {score.toFixed(0)}
    </span>
  );
}

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
  open,
  onClose,
  onLink,
}: {
  player: SquadPlayer;
  open: boolean;
  onClose: () => void;
  onLink: () => void;
}) {
  const hide = useHidePlayer();
  const slug = player.sorareSlug ?? player.sorare?.slug ?? null;
  const isLinked = slug != null;
  const sorare = player.sorare;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            {player.shirtNumber != null && (
              <span className="text-muted-foreground font-mono text-sm">#{player.shirtNumber}</span>
            )}
            {player.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {player.position}
            {player.nationality ? ` · ${player.nationality}` : ""}
            {player.dateOfBirth ? ` · Age ${calcAge(player.dateOfBirth)}` : ""}
          </p>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {isLinked && sorare ? (
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
                  onClick={onLink}
                  className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
                >
                  Re-link
                </button>
                <a
                  href={`https://sorare.com/football/players/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  View on Sorare <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </>
          ) : isLinked ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Linked but no Sorare data available yet.</p>
              <div className="flex items-center justify-between">
                <button onClick={onLink} className="text-[11px] text-muted-foreground hover:text-primary transition-colors">Re-link</button>
                <a
                  href={`https://sorare.com/football/players/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  View on Sorare <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground italic">Not yet linked to Sorare.</p>
              <button
                onClick={onLink}
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Link2 className="w-3.5 h-3.5" /> Link to Sorare
              </button>
            </div>
          )}

          {/* Admin: hide / unhide duplicate FD entries */}
          <div className="border-t border-border/30 pt-3">
            {player.hidden ? (
              <button
                onClick={async () => {
                  await hide.mutateAsync({ fdPlayerId: player.id, hidden: false, name: player.name });
                  onClose();
                }}
                disabled={hide.isPending}
                className="text-[11px] text-muted-foreground/50 hover:text-primary transition-colors disabled:opacity-40"
              >
                Unhide player
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (!window.confirm(`Hide "${player.name}" from the squad view?`)) return;
                  await hide.mutateAsync({ fdPlayerId: player.id, hidden: true, name: player.name });
                  onClose();
                }}
                disabled={hide.isPending}
                className="text-[11px] text-muted-foreground/50 hover:text-destructive transition-colors disabled:opacity-40"
              >
                Hide duplicate entry
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Link-to-Sorare dialog ─────────────────────────────────────────────────────

function CandidateList({
  candidates,
  onSave,
  isPending,
}: {
  candidates: SorareCandidate[];
  onSave: (slug: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-1">
      {candidates.map(c => (
        <button
          key={c.slug}
          onClick={() => onSave(c.slug)}
          disabled={isPending}
          className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded border border-border/50 bg-muted/10 hover:bg-muted/30 hover:border-primary/40 transition-colors text-left"
        >
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{c.displayName}</div>
            <div className="text-[10px] text-muted-foreground truncate">{c.slug}</div>
          </div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
            c.score === 1 ? "bg-green-500/15 text-green-400" :
            c.score >= 0.5 ? "bg-yellow-500/15 text-yellow-400" :
            "bg-muted/30 text-muted-foreground"
          }`}>
            {c.score === 1 ? "exact" : c.score >= 0.5 ? "likely" : "partial"}
          </span>
        </button>
      ))}
    </div>
  );
}

function LinkDialog({
  player,
  sorareTeamSlug,
  open,
  onClose,
}: {
  player: SquadPlayer;
  sorareTeamSlug: string | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const [manualSlug, setManualSlug] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState<string | null>(null);

  const { data, isLoading } = useSorareCandidates(open ? player.id : null, sorareTeamSlug);
  const { data: searchData, isLoading: searchLoading } = useSorareSearch(activeSearch);
  const link = useLinkPlayer();

  async function save(slug: string) {
    await link.mutateAsync({ fdPlayerId: player.id, sorareSlug: slug, name: player.name });
    onClose();
  }

  function triggerSearch() {
    const q = searchInput.trim();
    if (q.length >= 2) setActiveSearch(q);
  }

  const candidates = data?.candidates ?? [];
  const searchResults = searchData?.results ?? [];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Link "{player.name}" to Sorare</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Ranked candidates */}
          {isLoading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded" />)}
            </div>
          ) : candidates.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1.5">Suggestions</p>
              <CandidateList candidates={candidates} onSave={save} isPending={link.isPending} />
            </div>
          ) : (
            !isLoading && <p className="text-xs text-muted-foreground italic">No candidates found in team pool.</p>
          )}

          {/* Sorare name search */}
          <div className="space-y-1.5 border-t border-border/40 pt-3">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Search Sorare by name</p>
              <p className="text-[10px] text-muted-foreground/60">Use the full name</p>
            </div>
            <div className="flex gap-2">
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && triggerSearch()}
                placeholder={player.name}
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
            {searchResults.length > 0 && (
              <div className="pt-1">
                <CandidateList candidates={searchResults} onSave={save} isPending={link.isPending} />
              </div>
            )}
            {activeSearch && !searchLoading && searchResults.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No results for "{activeSearch}" — try the full name</p>
            )}
          </div>

          {/* Manual fallback */}
          <div className="space-y-1.5 border-t border-border/40 pt-3">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Enter slug manually</p>
            <div className="flex gap-2">
              <input
                value={manualSlug}
                onChange={e => setManualSlug(e.target.value)}
                placeholder="e.g. kylian-mbappe-lottin"
                className="flex-1 bg-muted/20 border border-border/50 rounded px-2.5 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60"
              />
              <button
                onClick={() => manualSlug.trim() && save(manualSlug.trim())}
                disabled={!manualSlug.trim() || link.isPending}
                className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Individual player row ─────────────────────────────────────────────────────

function PlayerRow({ player, onLink, onView }: {
  player: SquadPlayer;
  onLink: (p: SquadPlayer) => void;
  onView: (p: SquadPlayer) => void;
}) {
  const hasLiveData = player.sorare != null;
  const slug = player.sorareSlug ?? player.sorare?.slug ?? null;
  const isLinked = slug != null;
  const club = player.sorare?.currentClub ?? null;

  return (
    <div
      onClick={() => onView(player)}
      className={`flex items-center gap-3 px-3 py-2.5 rounded transition-colors cursor-pointer ${player.hidden ? "opacity-40" : isLinked ? "bg-muted/10 hover:bg-muted/20" : "bg-muted/5 hover:bg-muted/10"}`}
    >
      {/* Kit number */}
      <span className="w-5 text-center text-[11px] text-muted-foreground font-mono shrink-0">
        {player.shirtNumber ?? "—"}
      </span>

      {/* Name + club */}
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm truncate ${!isLinked || player.hidden ? "opacity-60" : ""}`}>{player.name}</div>
        {club && !player.hidden && <div className="text-[11px] text-muted-foreground truncate">{club}</div>}
      </div>

      {/* Sorare data */}
      {isLinked ? (
        <div className="flex items-center gap-2 shrink-0">
          {hasLiveData && <ScoreBar scores={player.sorare!.recentScores} />}
          {hasLiveData && player.sorare!.avgScore !== null && (
            <AvgBadge score={player.sorare!.avgScore} />
          )}
          <span className={`flex items-center gap-0.5 text-[10px] shrink-0 ${hasLiveData ? "text-primary" : "text-muted-foreground"}`}>
            <Link2 className="w-2.5 h-2.5" /> Sorare
          </span>
        </div>
      ) : (
        <button
          onClick={e => { e.stopPropagation(); onLink(player); }}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary shrink-0 transition-colors"
          title={`Link ${player.name} to Sorare`}
        >
          <Link2 className="w-3 h-3" /> Link
        </button>
      )}
    </div>
  );
}

// ── Squad view ────────────────────────────────────────────────────────────────

function SquadView({ teamId, staticTeam }: { teamId: number; staticTeam: WCTeam | undefined }) {
  const { data, isLoading, error } = useWCSquad(teamId, staticTeam?.slug);
  const [linking, setLinking] = useState<SquadPlayer | null>(null);
  const [viewing, setViewing] = useState<SquadPlayer | null>(null);

  const grouped = useMemo(() => {
    if (!data) return null;
    const map = new Map<string, SquadPlayer[]>();
    for (const pos of POSITION_ORDER) map.set(pos, []);
    for (const p of data.players) {
      const key = POSITION_ORDER.includes(p.position as any) ? p.position : "Offence";
      map.get(key)!.push(p);
    }
    // Sort each group: shirt number asc, then by name
    for (const [, players] of map) {
      players.sort((a, b) =>
        (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99) || a.name.localeCompare(b.name)
      );
    }
    return map;
  }, [data]);

  const visiblePlayers = data?.players.filter(p => !p.hidden) ?? [];
  const sorareCount = visiblePlayers.filter(p => p.sorareSlug != null).length;

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
      <div className="flex items-center gap-3">
        {staticTeam ? (
          <span className="text-3xl">{staticTeam.flag}</span>
        ) : data?.teamCrest ? (
          <img src={data.teamCrest} alt="" className="w-8 h-8 object-contain" />
        ) : null}
        <div>
          <h3 className="text-xl font-bold">{data?.teamName ?? "Loading…"}</h3>
          {data && (
            <p className="text-xs text-muted-foreground">
              {visiblePlayers.length} players · {sorareCount} on Sorare
            </p>
          )}
        </div>
      </div>

      {/* Legend */}
      {data && (
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-green-500/60" /> ≥ 60 avg
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-yellow-500/60" /> 45–59
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-orange-500/60" /> 30–44
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-red-500/60" /> &lt; 30
          </span>
        </div>
      )}

      {/* Position groups */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
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
                  {players.map(p => <PlayerRow key={p.id} player={p} onLink={setLinking} onView={setViewing} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {viewing && (
        <PlayerDetailDialog
          player={viewing}
          open={true}
          onClose={() => setViewing(null)}
          onLink={() => { setLinking(viewing); setViewing(null); }}
        />
      )}
      {linking && (
        <LinkDialog player={linking} sorareTeamSlug={staticTeam?.slug} open={true} onClose={() => setLinking(null)} />
      )}
    </div>
  );
}

// ── Team selector ─────────────────────────────────────────────────────────────

type ConfederationFilter = WCTeam["confederation"] | "ALL";

function TeamSelector({
  fdTeams,
  fdLoading,
  fdError,
  onSelect,
}: {
  fdTeams: WCTeamRef[] | undefined;
  fdLoading: boolean;
  fdError: Error | null;
  onSelect: (teamId: number, staticTeam: WCTeam | undefined) => void;
}) {
  const [confederation, setConfederation] = useState<ConfederationFilter>("ALL");

  const confederations: ConfederationFilter[] = ["ALL", "UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC"];

  // Build a lookup: our static team → football-data.org team ID
  const idLookup = useMemo(() => {
    const map = new Map<string, number>(); // staticTeam.slug → fdId
    if (!fdTeams) return map;
    for (const fd of fdTeams) {
      const match = matchStaticTeam(fd);
      if (match) map.set(match.slug, fd.id);
    }
    return map;
  }, [fdTeams]);

  const filtered = confederation === "ALL"
    ? WORLD_CUP_2026_TEAMS
    : WORLD_CUP_2026_TEAMS.filter(t => t.confederation === confederation);

  return (
    <div className="space-y-4">
      {fdError && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
          {fdError.message}
        </div>
      )}

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
          const fdId = idLookup.get(team.slug);
          const hasData = !!fdId;
          const confColor = CONFEDERATION_COLORS[team.confederation];

          return (
            <button
              key={team.slug}
              onClick={() => fdId && onSelect(fdId, team)}
              disabled={fdLoading || !hasData}
              data-testid={`team-${team.slug}`}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all ${
                !hasData
                  ? "opacity-40 cursor-not-allowed bg-card border-border/30"
                  : "bg-card border-border/50 hover:bg-muted/20 hover:border-primary/40 cursor-pointer"
              }`}
              title={!hasData ? "Not in WC 2026 data yet" : team.name}
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

      {fdLoading && (
        <p className="text-xs text-muted-foreground text-center animate-pulse">Loading team list from football-data.org…</p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorldCup() {
  const { data: teamsData, isLoading: teamsLoading, error: teamsError } = useWCTeams();
  const [selected, setSelected] = useState<{ teamId: number; staticTeam: WCTeam | undefined } | null>(null);

  return (
    <div className="space-y-6" data-testid="page-world-cup">
      {/* Page header */}
      <div className="flex items-center gap-3">
        {selected && (
          <button
            onClick={() => setSelected(null)}
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
        /* Squad view */
        <Card className="bg-card">
          <CardContent className="p-5">
            <SquadView teamId={selected.teamId} staticTeam={selected.staticTeam} />
          </CardContent>
        </Card>
      ) : (
        /* Team selector */
        <TeamSelector
          fdTeams={teamsData?.teams}
          fdLoading={teamsLoading}
          fdError={teamsError as Error | null}
          onSelect={(teamId, staticTeam) => setSelected({ teamId, staticTeam })}
        />
      )}
    </div>
  );
}
