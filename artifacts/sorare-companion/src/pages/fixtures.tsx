import { useState, useMemo } from "react";
import { useWCFixtures, useWCSquad, type WCMatch, type WCRound, type SquadPlayer } from "@/hooks/useWorldCup";
import { WORLD_CUP_2026_TEAMS, CONFEDERATION_COLORS } from "@/data/world-cup-2026";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { POSITION_ORDER, POSITION_LABEL, PlayerRow } from "@/components/squad-shared";

// ── Read-only squad panel (for use inside dialogs) ───────────────────────────


function SquadPanel({ teamSlug }: { teamSlug: string }) {
  const { data, isLoading, error } = useWCSquad(teamSlug);

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
        {error instanceof Error ? error.message : "Failed to load squad"}
      </p>
    );
  }

  if (!data?.players.length) {
    return <p className="text-sm text-muted-foreground italic">No squad data yet.</p>;
  }

  const grouped = new Map<string, SquadPlayer[]>();
  for (const pos of POSITION_ORDER) grouped.set(pos, []);
  for (const p of data.players) {
    const key = POSITION_ORDER.includes(p.position as any) ? p.position : "Offence";
    grouped.get(key)!.push(p);
  }
  for (const players of grouped.values()) players.sort((a, b) => a.name.localeCompare(b.name));

  const sorareCount = data.players.filter(p => p.sorare != null).length;

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground">
        {data.players.length} players · {sorareCount} with Sorare data
      </p>
      {POSITION_ORDER.map(pos => {
        const players = grouped.get(pos) ?? [];
        if (!players.length) return null;
        return (
          <div key={pos}>
            <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              {POSITION_LABEL[pos]} ({players.length})
            </h5>
            <Card className="bg-card">
              <CardContent className="p-0">
                {players.map(p => (
                  <PlayerRow
                    key={p.name}
                    player={{
                      name: p.name,
                      position: p.position,
                      teamName: p.sorare?.currentClub ?? null,
                      score: p.sorare?.avgScore ?? null,
                      recentScores: p.sorare?.recentScores ?? null,
                      sorareSlug: p.sorare ? p.sorareSlug : null,
                    }}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

// ── Team detail dialog ────────────────────────────────────────────────────────

type MatchWithRound = WCMatch & { roundLabel: string };

function TeamMatchRow({ match, teamSlug }: { match: MatchWithRound; teamSlug: string }) {
  const isHome = match.homeTeam?.sorareSlug === teamSlug;
  const opponent = isHome ? match.awayTeam : match.homeTeam;
  const teamScore = isHome ? match.homeScore : match.awayScore;
  const oppScore = isHome ? match.awayScore : match.homeScore;
  const kickoff = new Date(match.utcDate);
  const isFinished = match.status === "FINISHED";
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const hasScore = teamScore !== null && oppScore !== null;

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded bg-muted/10 text-xs">
      <span className="text-muted-foreground text-[10px] w-28 shrink-0 truncate">{match.roundLabel}</span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="text-muted-foreground">{isHome ? "vs" : "@"}</span>
        {opponent?.crest && (
          <img src={opponent.crest} alt="" className="w-4 h-4 object-contain shrink-0" />
        )}
        <span className="font-medium truncate">{opponent?.name ?? "TBD"}</span>
      </div>
      <div className="shrink-0 text-right min-w-[52px]">
        {isLive ? (
          <span className="font-mono font-bold text-primary">
            {teamScore ?? 0}–{oppScore ?? 0}
            <span className="ml-1 text-[9px] bg-primary/15 px-1 py-0.5 rounded font-bold">LIVE</span>
          </span>
        ) : isFinished && hasScore ? (
          <span className={`font-mono font-bold tabular-nums ${
            teamScore! > oppScore! ? "text-green-400" :
            teamScore! < oppScore! ? "text-red-400" :
            "text-muted-foreground"
          }`}>
            {teamScore}–{oppScore}
          </span>
        ) : (
          <span className="text-muted-foreground font-mono text-[10px]">
            {kickoff.toLocaleDateString([], { day: "numeric", month: "short" })}
          </span>
        )}
      </div>
    </div>
  );
}

export function TeamDetailDialog({
  slug,
  name,
  crest,
  open,
  onClose,
}: {
  slug: string;
  name: string;
  crest?: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data: rounds } = useWCFixtures();
  const team = WORLD_CUP_2026_TEAMS.find(t => t.slug === slug) ?? null;
  const confColor = team ? CONFEDERATION_COLORS[team.confederation] : "";

  const teamMatches = useMemo<MatchWithRound[]>(() => {
    if (!rounds) return [];
    return rounds.flatMap(r =>
      r.matches
        .filter(m => m.homeTeam?.sorareSlug === slug || m.awayTeam?.sorareSlug === slug)
        .map(m => ({ ...m, roundLabel: r.label }))
    );
  }, [rounds, slug]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-3">
            {crest ? (
              <img src={crest} alt={name} className="w-10 h-10 object-contain shrink-0" />
            ) : team ? (
              <span className="text-3xl shrink-0">{team.flag}</span>
            ) : null}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-xl font-bold leading-tight">{name}</DialogTitle>
              </div>
              {team && (
                <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${confColor}`}>
                  {team.confederation}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Matches */}
          {teamMatches.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                World Cup Matches
              </h4>
              <div className="space-y-1">
                {teamMatches.map(m => (
                  <TeamMatchRow key={m.id} match={m} teamSlug={slug} />
                ))}
              </div>
            </div>
          )}

          {/* Squad */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Squad
            </h4>
            <SquadPanel teamSlug={slug} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Fixture rows ──────────────────────────────────────────────────────────────

type TeamClickHandler = (slug: string, name: string, crest?: string) => void;

function TeamName({ name, sorareSlug, crest, onTeamClick }: { name: string; sorareSlug?: string; crest?: string; onTeamClick: TeamClickHandler }) {
  const base = "font-medium truncate text-xs";
  if (!sorareSlug) return <span className={base}>{name}</span>;
  return (
    <button
      className={`${base} hover:text-primary hover:underline underline-offset-2 transition-colors`}
      onClick={e => { e.stopPropagation(); onTeamClick(sorareSlug, name, crest); }}
    >
      {name}
    </button>
  );
}

function GameRow({ match, onTeamClick }: { match: WCMatch; onTeamClick: TeamClickHandler }) {
  const kickoff = new Date(match.utcDate);
  const isFinished = match.status === "FINISHED";
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const hasScore = match.homeScore !== null && match.awayScore !== null;

  return (
    <div
      className="flex items-center gap-2 py-2.5 px-3 rounded bg-muted/10 hover:bg-muted/20 transition-colors text-sm"
      data-testid={`row-match-${match.id}`}
    >
      {/* Home team */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {match.homeTeam?.crest ? (
          <img src={match.homeTeam.crest} alt="" className="w-5 h-5 object-contain shrink-0" />
        ) : (
          <div className="w-5 h-5 bg-muted/40 rounded-full shrink-0" />
        )}
        <TeamName
          name={match.homeTeam?.name ?? "TBD"}
          sorareSlug={match.homeTeam?.sorareSlug}
          crest={match.homeTeam?.crest ?? undefined}
          onTeamClick={onTeamClick}
        />
      </div>

      {/* Score / Kickoff */}
      <div className="shrink-0 text-center min-w-[60px]">
        {isLive ? (
          <span className="font-mono font-bold text-primary text-sm">
            {match.homeScore ?? 0} – {match.awayScore ?? 0}
            <span className="ml-1 text-[9px] bg-primary/15 text-primary px-1 py-0.5 rounded font-bold uppercase">
              LIVE
            </span>
          </span>
        ) : isFinished && hasScore ? (
          <span className="font-mono font-bold text-primary text-sm">
            {match.homeScore} – {match.awayScore}
          </span>
        ) : (
          <div className="text-center">
            <div className="font-mono text-xs text-primary">
              {kickoff.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {kickoff.toLocaleDateString([], { day: "numeric", month: "short" })}
            </div>
          </div>
        )}
      </div>

      {/* Group badge */}
      {match.group && (
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60 hidden sm:inline">
          {match.group}
        </span>
      )}

      {/* Away team */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5 justify-end">
        <TeamName
          name={match.awayTeam?.name ?? "TBD"}
          sorareSlug={match.awayTeam?.sorareSlug}
          crest={match.awayTeam?.crest ?? undefined}
          onTeamClick={onTeamClick}
        />
        {match.awayTeam?.crest ? (
          <img src={match.awayTeam.crest} alt="" className="w-5 h-5 object-contain shrink-0" />
        ) : (
          <div className="w-5 h-5 bg-muted/40 rounded-full shrink-0" />
        )}
      </div>
    </div>
  );
}

function RoundSection({
  round,
  defaultExpanded,
  onTeamClick,
}: {
  round: WCRound;
  defaultExpanded?: boolean;
  onTeamClick: TeamClickHandler;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);

  const now = new Date();
  const isLive = round.matches.some(m => m.status === "IN_PLAY" || m.status === "PAUSED");
  const isActive = isLive || (new Date(round.startDate) <= now && new Date(round.endDate) >= now);

  return (
    <Card
      className={`bg-card ${isActive ? "border-primary/30" : ""}`}
      data-testid={`card-round-${round.id}`}
    >
      <CardContent className="p-5">
        <button
          className="w-full flex items-center justify-between gap-3"
          onClick={() => setExpanded(v => !v)}
          data-testid={`button-expand-${round.id}`}
        >
          <div className="flex items-center gap-3 text-left">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">{round.label}</h3>
                {isLive && (
                  <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    LIVE
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Calendar className="w-3 h-3" />
                <span>
                  {new Date(round.startDate).toLocaleDateString([], {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!expanded && (
              <span className="text-xs text-muted-foreground">{round.matches.length} matches</span>
            )}
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="mt-4 space-y-1.5">
            {round.matches.length === 0 ? (
              <div className="text-muted-foreground text-sm text-center py-4">
                No matches scheduled yet.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 text-[10px] uppercase tracking-wide text-muted-foreground px-3 pb-1">
                  <span>Home</span>
                  <span className="text-center">Score / KO</span>
                  <span className="text-right">Away</span>
                </div>
                {round.matches.map(m => (
                  <GameRow key={m.id} match={m} onTeamClick={onTeamClick} />
                ))}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Fixtures() {
  const { data: rounds, isLoading, isError } = useWCFixtures();
  const [selectedTeam, setSelectedTeam] = useState<{ slug: string; name: string; crest?: string } | null>(null);

  const now = new Date();
  const defaultExpandIndex = rounds
    ? Math.max(
        0,
        rounds.findIndex(r => new Date(r.endDate) >= now),
      )
    : 0;

  function handleTeamClick(slug: string, name: string, crest?: string) {
    setSelectedTeam({ slug, name, crest });
  }

  return (
    <div className="space-y-5" data-testid="page-fixtures">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">FIFA World Cup 2026</h2>
        <p className="text-muted-foreground mt-1">Full match schedule from Sorare</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card">
              <CardContent className="p-5">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <div className="text-destructive p-8 text-center bg-card rounded-lg border border-border">
          Failed to load fixtures. Check that FOOTBALL_DATA_API_KEY is set and the API is reachable.
        </div>
      ) : !rounds?.length ? (
        <div className="text-muted-foreground p-8 text-center bg-card rounded-lg border border-border">
          No fixtures found.
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map((round, idx) => (
            <RoundSection
              key={round.id}
              round={round}
              defaultExpanded={idx === defaultExpandIndex}
              onTeamClick={handleTeamClick}
            />
          ))}
        </div>
      )}

      {selectedTeam && (
        <TeamDetailDialog
          slug={selectedTeam.slug}
          name={selectedTeam.name}
          crest={selectedTeam.crest}
          open={true}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
}
