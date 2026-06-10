import { useParams, useLocation, Link } from 'wouter';
import { ArrowLeft, Calendar, CheckCircle2, ChevronRight, Loader2, Shield, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useGameweeks,
  useGameweekTopPlayers,
  useGameweekGames,
  useGameweekPickedIds,
  type GameweekFixture,
  type GameweekGame,
} from '@/hooks/useApi';

// ── Types ─────────────────────────────────────────────────────────────────────

function gwStatus(gw: GameweekFixture): 'open' | 'live' | 'finished' {
  const now = Date.now();
  const start = new Date(gw.startDate).getTime();
  const end = new Date(gw.endDate).getTime();
  if (now < start) return 'open';
  if (now <= end) return 'live';
  return 'finished';
}

// ── Games section ─────────────────────────────────────────────────────────────

function gameStatus(utcDate: string): 'scheduled' | 'live' | 'finished' {
  const kick = new Date(utcDate).getTime();
  const now = Date.now();
  const elapsed = (now - kick) / 60000;
  if (elapsed < 0) return 'scheduled';
  if (elapsed < 150) return 'live';
  return 'finished';
}

function GameRow({
  game,
  leagueCode,
  gameweekSlug,
  hasPicks,
}: {
  game: GameweekGame;
  leagueCode: string;
  gameweekSlug: string;
  hasPicks: boolean;
}) {
  const status = gameStatus(game.utcDate);
  const kickoff = new Date(game.utcDate).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const date = new Date(game.utcDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });

  return (
    <Link href={`/league/${leagueCode}/gameweeks/${gameweekSlug}/games/${game.sorareId}`}>
      <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 hover:border-primary/40 hover:bg-card transition-all cursor-pointer ${hasPicks ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border/30 bg-card/40'}`}>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {game.homeTeamCrest ? (
            <img src={game.homeTeamCrest} alt="" className="w-5 h-5 object-contain shrink-0" />
          ) : (
            <Shield className="w-5 h-5 text-muted-foreground/30 shrink-0" />
          )}
          <span className="text-sm font-semibold truncate">{game.homeTeamName ?? '—'}</span>
        </div>

        <div className="shrink-0 text-center px-2">
          {status === 'live' ? (
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest animate-pulse">Live</span>
          ) : status === 'finished' ? (
            <span className="text-[10px] text-muted-foreground/50 font-medium">FT</span>
          ) : (
            <div className="text-center">
              <p className="text-[10px] font-bold text-muted-foreground tabular-nums">{kickoff}</p>
              <p className="text-[9px] text-muted-foreground/50">{date}</p>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="flex-1 min-w-0 text-sm font-semibold truncate text-right">{game.awayTeamName ?? '—'}</span>
          {game.awayTeamCrest ? (
            <img src={game.awayTeamCrest} alt="" className="w-5 h-5 object-contain shrink-0" />
          ) : (
            <Shield className="w-5 h-5 text-muted-foreground/30 shrink-0" />
          )}
          {hasPicks
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
          }
        </div>
      </div>
    </Link>
  );
}

function GamesSection({ gw, leagueCode }: { gw: GameweekFixture; leagueCode: string }) {
  const { session } = useAuth();
  const { data: gwGames, isLoading } = useGameweekGames(gw.slug, gw.startDate, gw.endDate);
  const { data: pickedIds } = useGameweekPickedIds(leagueCode, gw.slug, gw.startDate, gw.endDate, session);
  const pickedSet = new Set(pickedIds ?? []);

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5" />
        Matches
      </h2>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : !gwGames?.length ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No matches found. Run a World Cup sync to populate game data.
        </p>
      ) : (
        <div className="space-y-2">
          {gwGames.map(g => (
            <GameRow
              key={g.sorareId}
              game={g}
              leagueCode={leagueCode}
              gameweekSlug={gw.slug}
              hasPicks={pickedSet.has(g.sorareId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Top players section ───────────────────────────────────────────────────────

function TopPlayersSection({ gameweekSlug }: { gameweekSlug: string }) {
  const { data: topPlayers, isLoading } = useGameweekTopPlayers(gameweekSlug);

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <Star className="w-3.5 h-3.5" />
        Top players
      </h2>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : !topPlayers?.length ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Scores not available yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {topPlayers.map((p, i) => (
            <div
              key={p.slug}
              className="flex items-center gap-3 rounded-xl border border-border/30 bg-card/40 px-4 py-2.5"
            >
              <span className="w-5 shrink-0 text-xs font-black text-muted-foreground/50 tabular-nums text-right">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{p.displayName}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {p.currentClub ?? '—'} · {p.position}
                </p>
              </div>
              <span className="shrink-0 text-sm font-black text-primary tabular-nums">
                {p.score.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GameweekDetail() {
  const { code, slug } = useParams<{ code: string; slug: string }>();
  const [, navigate] = useLocation();

  const { data: gameweeks } = useGameweeks();
  const gw = gameweeks?.find(g => g.slug === slug) ?? null;

  const status = gw ? gwStatus(gw) : null;

  const gwLabel = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const statusBadge = (() => {
    if (status === 'open') return { label: 'Open', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    if (status === 'live') return { label: 'Live', className: 'bg-red-500/15 text-red-400 border-red-500/30 animate-pulse' };
    return { label: 'Finished', className: 'bg-muted/20 text-muted-foreground border-border/40' };
  })();

  if (!gw && gameweeks) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-3">
        <Calendar className="w-10 h-10 text-muted-foreground/40 mx-auto" />
        <p className="text-sm text-muted-foreground">Gameweek not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back + header */}
      <div className="space-y-3">
        <button
          onClick={() => navigate(`/league/${code}`)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to league
        </button>

        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary shrink-0" />
              <h1 className="text-2xl font-black tracking-tight">{gwLabel}</h1>
            </div>
            {gw && (
              <p className="text-xs text-muted-foreground pl-7">
                {fmt(new Date(gw.startDate))} – {fmt(new Date(gw.endDate))}
              </p>
            )}
          </div>
          {status && (
            <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
          )}
        </div>
      </div>

      {/* Loading state */}
      {!gw && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Matches — click a game to pick a squad for it */}
      {gw && <GamesSection gw={gw} leagueCode={code} />}

      {/* Top players when gameweek is finished */}
      {gw && (status === 'live' || status === 'finished') && (
        <TopPlayersSection gameweekSlug={slug} />
      )}
    </div>
  );
}
