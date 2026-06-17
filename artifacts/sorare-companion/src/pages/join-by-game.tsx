import { useState, useMemo, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useSearch } from 'wouter';
import { Loader2, Mail, CheckCircle, Trophy, Search, Shield, Swords, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useGame, useLeague, usePlayers, type DbPlayer, type GameweekGame } from '@/hooks/useApi';
import { PlayerRow, ScoreBar, AvgBadge } from '@/components/squad-shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ── Constants ─────────────────────────────────────────────────────────────────

const SLOTS = [
  { id: 'gk',   label: 'GK',   position: 'Goalkeeper' as string | null },
  { id: 'def',  label: 'DEF',  position: 'Defence'    as string | null },
  { id: 'mid',  label: 'MID',  position: 'Midfield'   as string | null },
  { id: 'fwd',  label: 'FWD',  position: 'Offence'    as string | null },
  { id: 'flex', label: 'FLEX', position: null },
];

const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50";
const btnClass = "w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

// ── Helpers ───────────────────────────────────────────────────────────────────

function gameStatus(utcDate: string): 'open' | 'live' | 'finished' {
  const elapsed = (Date.now() - new Date(utcDate).getTime()) / 60000;
  if (elapsed < 0) return 'open';
  if (elapsed < 150) return 'live';
  return 'finished';
}

function matchesSlot(player: DbPlayer, position: string | null): boolean {
  if (position === null) return player.position !== 'Goalkeeper';
  return player.position === position;
}

// ── Player picker dialog ───────────────────────────────────────────────────────

function PlayerPickerDialog({
  slotLabel,
  slotPosition,
  players,
  excludeIds,
  onSelect,
  onClose,
}: {
  slotLabel: string;
  slotPosition: string | null;
  players: DbPlayer[];
  excludeIds: Set<number>;
  onSelect: (player: DbPlayer) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');

  const eligible = useMemo(() => {
    const filtered = players.filter(p => matchesSlot(p, slotPosition) && !excludeIds.has(p.id));
    const searched = q.trim()
      ? filtered.filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
      : filtered;
    return searched.sort((a, b) => (b.avg5Score ?? 0) - (a.avg5Score ?? 0));
  }, [players, slotPosition, excludeIds, q]);

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">
            Pick {slotLabel === 'FLEX' ? 'any player (non-GK)' : slotLabel}
          </DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              autoFocus
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-muted/20 focus:outline-none focus:ring-1 focus:ring-primary/50"
              placeholder="Search players…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-y-auto max-h-72 pb-2">
          {eligible.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No players found.</p>
          ) : (
            eligible.map(p => (
              <PlayerRow
                key={p.id}
                player={{
                  name: p.name,
                  position: p.position,
                  teamName: p.teamName ?? null,
                  score: p.avg5Score,
                  recentScores: p.recentScores ?? null,
                  sorareSlug: p.sorareSlug,
                }}
                onClick={() => onSelect(p)}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Squad slot row ─────────────────────────────────────────────────────────────

function SquadSlotRow({
  label,
  player,
  onTap,
  onClear,
}: {
  label: string;
  player: DbPlayer | null;
  onTap: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all ${
        !player
          ? 'border-dashed border-border/50 bg-transparent hover:border-primary/40 hover:bg-muted/10'
          : 'border-border/50 bg-card/60 hover:border-primary/40'
      }`}
      onClick={onTap}
    >
      <span className="w-10 shrink-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">
        {label}
      </span>
      {player ? (() => {
        const parts = player.name.trim().split(/\s+/);
        const initials = parts.length >= 2
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
          : player.name.slice(0, 2).toUpperCase();
        return (
          <>
            <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-sm font-black select-none shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{player.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{player.teamName ?? '—'}</p>
            </div>
            {player.recentScores && player.recentScores.length > 0 && (
              <ScoreBar scores={player.recentScores} />
            )}
            {player.avg5Score != null && <AvgBadge score={player.avg5Score} />}
            <button
              onClick={e => { e.stopPropagation(); onClear(); }}
              className="shrink-0 p-1 rounded-md hover:bg-muted/40 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        );
      })() : (
        <p className="flex-1 text-sm text-muted-foreground/60 italic">+ Pick {label}</p>
      )}
    </div>
  );
}

// ── Game header ────────────────────────────────────────────────────────────────

function GameHeaderCard({ game }: { game: GameweekGame }) {
  const kickoff = new Date(game.utcDate);
  const dateLabel = kickoff.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const timeLabel = kickoff.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/40 bg-card/60 px-5 py-4">
      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
        {game.homeTeamCrest ? (
          <img src={game.homeTeamCrest} alt="" className="w-10 h-10 object-contain" />
        ) : (
          <Shield className="w-10 h-10 text-muted-foreground/30" />
        )}
        <p className="text-sm font-bold text-center truncate w-full">{game.homeTeamName ?? '—'}</p>
      </div>
      <div className="shrink-0 flex flex-col items-center gap-0.5 min-w-[60px]">
        <Swords className="w-4 h-4 text-muted-foreground/40" />
        <p className="text-[10px] font-bold text-muted-foreground tabular-nums">{timeLabel}</p>
        <p className="text-[9px] text-muted-foreground/50">{dateLabel}</p>
      </div>
      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
        {game.awayTeamCrest ? (
          <img src={game.awayTeamCrest} alt="" className="w-10 h-10 object-contain" />
        ) : (
          <Shield className="w-10 h-10 text-muted-foreground/30" />
        )}
        <p className="text-sm font-bold text-center truncate w-full">{game.awayTeamName ?? '—'}</p>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function JoinByGame() {
  const { leagueCode, gameId } = useParams<{ leagueCode: string; gameId: string }>();
  const [, navigate] = useLocation();
  const { session, loading: authLoading } = useAuth();
  const search = useSearch();
  const isAutoJoin = new URLSearchParams(search).has('autojoin');

  const { data: game, isLoading: gameLoading } = useGame(gameId);
  const { data: league, isLoading: leagueLoading, isError: leagueError } = useLeague(leagueCode);
  const { data: allPlayers } = usePlayers(undefined, undefined, gameId);

  const [draftPicks, setDraftPicks] = useState<(DbPlayer | null)[]>([null, null, null, null, null]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [uiState, setUiState] = useState<'idle' | 'sending' | 'sent' | 'autojoin' | 'submitting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const status = game ? gameStatus(game.utcDate) : null;
  const isOpen = status === 'open';
  const storageKey = `fl-game-picks-${leagueCode}-${gameId}`;

  const allFilled = draftPicks.every(p => p !== null);

  // After OTP redirect: read picks from sessionStorage, join league, submit picks
  useEffect(() => {
    if (!isAutoJoin || authLoading || !session || !league || !game) return;
    if (uiState !== 'idle') return;

    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return; // No picks saved — user needs to pick (now authed)

    let pickIds: number[];
    try {
      pickIds = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(pickIds) || pickIds.length !== 5) return;

    if (!isOpen) {
      sessionStorage.removeItem(storageKey);
      setUiState('error');
      setErrorMsg('The game kicked off before your picks could be submitted. You can still join the league for future games!');
      return;
    }

    setUiState('autojoin');
    (async () => {
      try {
        await fetch(`/api/leagues/${leagueCode}/join`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const res = await fetch(`/api/leagues/${leagueCode}/picks/game/${gameId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ playerIds: pickIds }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? 'Failed to submit picks');
        }
        sessionStorage.removeItem(storageKey);
        navigate(`/league/${leagueCode}`);
      } catch (err) {
        setUiState('error');
        setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
    })();
  }, [isAutoJoin, authLoading, session, league, game, isOpen, uiState]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setUiState('sending');
    sessionStorage.setItem(storageKey, JSON.stringify(draftPicks.map(p => p!.id)));
    const returnTo = `/join/${leagueCode}/game/${gameId}?autojoin=true`;
    const emailRedirectTo = `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo },
    });
    if (error) {
      setErrorMsg(error.message);
      setUiState('idle');
    } else {
      setUiState('sent');
    }
  };

  const handleSubmitAuthed = async () => {
    if (!session || !allFilled) return;
    setUiState('submitting');
    setErrorMsg('');
    try {
      await fetch(`/api/leagues/${leagueCode}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const res = await fetch(`/api/leagues/${leagueCode}/picks/game/${gameId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ playerIds: draftPicks.map(p => p!.id) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to submit picks');
      }
      navigate(`/league/${leagueCode}`);
    } catch (err) {
      setUiState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  // Auto-joining state
  if (uiState === 'autojoin') {
    return (
      <div className="min-h-screen bg-background text-foreground dark flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Joining league and submitting your picks…</p>
        </div>
      </div>
    );
  }

  // Loading
  if (gameLoading || leagueLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not found
  if (!game || leagueError || !league) {
    return (
      <div className="min-h-screen bg-background text-foreground dark flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-3">
          <Trophy className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold">Invite link not found</p>
          <p className="text-sm text-muted-foreground">This link may be invalid or have expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Brand + league */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Trophy className="w-6 h-6 text-primary" />
            <span className="text-lg font-black tracking-tight">Fantasy Legends</span>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{league.name}</span>
            {' · '}World Cup 2026
          </p>
        </div>

        {/* Game card */}
        <GameHeaderCard game={game} />

        {/* Game already started */}
        {!isOpen && (
          <div className="rounded-xl border border-border/30 bg-muted/10 px-4 py-5 space-y-4 text-center">
            <p className="text-sm font-medium">This game has already kicked off</p>
            <p className="text-xs text-muted-foreground">
              Picks are locked, but you can still join the league and compete in upcoming games.
            </p>
            {uiState === 'error' && (
              <p className="text-xs text-amber-400">{errorMsg}</p>
            )}
            {session ? (
              <button
                onClick={async () => {
                  await fetch(`/api/leagues/${leagueCode}/join`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${session.access_token}` },
                  });
                  navigate(`/league/${leagueCode}`);
                }}
                className={btnClass}
              >
                Join {league.name}
              </button>
            ) : (
              <button
                onClick={() => navigate(`/join/${leagueCode}`)}
                className={btnClass}
              >
                Join the league
              </button>
            )}
          </div>
        )}

        {/* Squad picker — only for open games */}
        {isOpen && (
          <>
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Pick your squad
              </h2>
              <div className="space-y-2">
                {SLOTS.map((slot, i) => (
                  <SquadSlotRow
                    key={slot.id}
                    label={slot.label}
                    player={draftPicks[i]}
                    onTap={() => setActiveSlotIndex(i)}
                    onClear={() => setDraftPicks(prev => prev.map((p, j) => j === i ? null : p))}
                  />
                ))}
              </div>
            </section>

            {/* Action section — changes based on auth state */}
            <div className="space-y-3">
              {uiState === 'error' && (
                <p className="text-sm text-destructive text-center">{errorMsg}</p>
              )}

              {/* Already authenticated */}
              {session && (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg bg-muted/30 px-3 py-2.5">
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    <span>Signed in as <span className="font-medium text-foreground">{session.user.email}</span></span>
                  </div>
                  <button
                    onClick={handleSubmitAuthed}
                    disabled={!allFilled || uiState === 'submitting'}
                    className={btnClass}
                  >
                    {uiState === 'submitting' && <Loader2 className="w-4 h-4 animate-spin" />}
                    {uiState === 'submitting' ? 'Submitting…' : 'Submit picks & join'}
                  </button>
                  {!allFilled && (
                    <p className="text-xs text-center text-muted-foreground/60">
                      Pick all 5 players to continue
                    </p>
                  )}
                </>
              )}

              {/* Not authenticated */}
              {!session && uiState !== 'sent' && (
                <>
                  {allFilled ? (
                    <form onSubmit={handleSendOtp} className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Your email
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          disabled={uiState === 'sending'}
                          className={inputClass}
                          autoFocus
                        />
                      </div>
                      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
                      <button type="submit" disabled={uiState === 'sending'} className={btnClass}>
                        {uiState === 'sending' && <Loader2 className="w-4 h-4 animate-spin" />}
                        {uiState === 'sending' ? 'Sending link…' : 'Submit picks & join'}
                      </button>
                      <p className="text-xs text-center text-muted-foreground/60">
                        We'll send a magic link — no password needed.
                      </p>
                    </form>
                  ) : (
                    <p className="text-xs text-center text-muted-foreground/60 py-2">
                      Pick all 5 players above, then enter your email to join
                    </p>
                  )}
                </>
              )}

              {/* OTP sent */}
              {!session && uiState === 'sent' && (
                <div className="text-center space-y-4 py-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold">Check your inbox</p>
                    <p className="text-sm text-muted-foreground">
                      We sent a link to <span className="font-medium text-foreground">{email}</span>.
                      Click it to confirm your picks.
                    </p>
                  </div>
                  <button
                    onClick={() => { setUiState('idle'); setEmail(''); }}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Use a different email
                  </button>
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* Player picker dialog */}
      {activeSlotIndex !== null && allPlayers && (
        <PlayerPickerDialog
          slotLabel={SLOTS[activeSlotIndex].label}
          slotPosition={SLOTS[activeSlotIndex].position}
          players={allPlayers}
          excludeIds={new Set(draftPicks.filter(Boolean).map(p => p!.id))}
          onSelect={player => {
            setDraftPicks(prev => prev.map((p, i) => i === activeSlotIndex ? player : p));
            setActiveSlotIndex(null);
          }}
          onClose={() => setActiveSlotIndex(null)}
        />
      )}
    </div>
  );
}
