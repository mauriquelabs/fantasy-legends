import { useState, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Loader2, Search, Shield, Swords, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useGame,
  useMyGamePicks,
  usePlayers,
  type DbPlayer,
  type GameweekGame,
} from '@/hooks/useApi';
import { type CanonicalPosition } from '@workspace/db/constants';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlayerRow, ScoreBar, AvgBadge } from '@/components/squad-shared';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Slot {
  id: string;
  label: string;
  position: CanonicalPosition | null;
}

const SLOTS: Slot[] = [
  { id: 'gk',   label: 'GK',   position: 'Goalkeeper' },
  { id: 'def',  label: 'DEF',  position: 'Defence' },
  { id: 'mid',  label: 'MID',  position: 'Midfield' },
  { id: 'fwd',  label: 'FWD',  position: 'Offence' },
  { id: 'flex', label: 'FLEX', position: null },
];

function gameStatus(utcDate: string): 'open' | 'live' | 'finished' {
  const kick = new Date(utcDate).getTime();
  const now = Date.now();
  const elapsed = (now - kick) / 60000;
  if (elapsed < 0) return 'open';
  if (elapsed < 150) return 'live';
  return 'finished';
}


function matchesSlot(player: DbPlayer, slot: Slot): boolean {
  if (slot.position === null) return player.position !== 'Goalkeeper';
  return player.position === slot.position;
}

// ── Player picker dialog ───────────────────────────────────────────────────────

function PlayerPickerDialog({
  slot,
  players,
  excludeIds,
  onSelect,
  onClose,
}: {
  slot: Slot;
  players: DbPlayer[];
  excludeIds: Set<number>;
  onSelect: (player: DbPlayer) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');

  const eligible = useMemo(() => {
    const filtered = players.filter(p => matchesSlot(p, slot) && !excludeIds.has(p.id));
    const searched = q.trim()
      ? filtered.filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
      : filtered;
    return searched.sort((a, b) => (b.avg5Score ?? 0) - (a.avg5Score ?? 0));
  }, [players, slot, excludeIds, q]);

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">
            Pick {slot.label === 'FLEX' ? 'any player (non-GK)' : slot.label}
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
  slot,
  player,
  isOpen,
  onTap,
  onClear,
}: {
  slot: Slot;
  player: DbPlayer | null;
  isOpen: boolean;
  onTap?: () => void;
  onClear?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
        isOpen && !player
          ? 'border-dashed border-border/50 bg-transparent cursor-pointer hover:border-primary/40 hover:bg-muted/10 transition-all'
          : isOpen && player
          ? 'border-border/50 bg-card/60 cursor-pointer hover:border-primary/40 transition-all'
          : 'border-border/30 bg-card/40'
      }`}
      onClick={isOpen ? onTap : undefined}
    >
      <span className="w-10 shrink-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">
        {slot.label}
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
          </>
        );
      })() : (
        <p className="flex-1 text-sm text-muted-foreground/60 italic">
          {isOpen ? `+ Pick ${slot.label}` : 'No player selected'}
        </p>
      )}

      {isOpen && player && onClear && (
        <button
          onClick={e => { e.stopPropagation(); onClear(); }}
          className="shrink-0 p-1 rounded-md hover:bg-muted/40 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Game header ───────────────────────────────────────────────────────────────

function GameHeader({ game }: { game: GameweekGame }) {
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

      <div className="shrink-0 flex flex-col items-center gap-0.5">
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GameDetail() {
  const { code, slug, gameId } = useParams<{ code: string; slug: string; gameId: string }>();
  const [, navigate] = useLocation();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const { data: game, isLoading: gameLoading } = useGame(gameId);
  const { data: savedPicks, isLoading: picksLoading } = useMyGamePicks(code, gameId, session);
  const { data: allPlayers } = usePlayers(undefined, undefined, gameId);

  const [draftPicks, setDraftPicks] = useState<(DbPlayer | null)[]>(() => Array(5).fill(null));
  const [picksInitialized, setPicksInitialized] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const status = game ? gameStatus(game.utcDate) : null;
  const isOpen = status === 'open';
  const isClosedWithPicks = (status === 'live' || status === 'finished') && !!savedPicks;
  const isClosedNoPicks = (status === 'live' || status === 'finished') && !savedPicks && !picksLoading;

  // Hydrate draft picks from saved picks once players are loaded
  if (!picksInitialized && savedPicks && allPlayers?.length) {
    const playerMap = new Map(allPlayers.map(p => [p.id, p]));
    const hydrated = savedPicks.playerIds.map(id => playerMap.get(id) ?? null);
    const padded = [...hydrated, ...Array(5).fill(null)].slice(0, 5);
    setDraftPicks(padded);
    setPicksInitialized(true);
  }

  const isDirty = useMemo(() => {
    if (!savedPicks) return draftPicks.some(p => p !== null);
    const savedIds = savedPicks.playerIds;
    const draftIds = draftPicks.map(p => p?.id ?? null);
    return !savedIds.every((id, i) => id === draftIds[i]);
  }, [savedPicks, draftPicks]);

  const allFilled = draftPicks.every(p => p !== null);

  async function savePicks() {
    if (!session || !allFilled) return;
    setSaving(true);
    setSaveError(null);
    try {
      const playerIds = draftPicks.map(p => p!.id);
      const res = await fetch(`/api/leagues/${code}/picks/game/${gameId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ playerIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveError(err.error ?? 'Failed to save picks.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['api', 'picks', code, 'game', gameId] });
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const statusBadge = (() => {
    if (status === 'open') return { label: 'Open', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    if (status === 'live') return { label: 'Live', className: 'bg-red-500/15 text-red-400 border-red-500/30 animate-pulse' };
    return { label: 'Finished', className: 'bg-muted/20 text-muted-foreground border-border/40' };
  })();

  if (!game && !gameLoading) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-3">
        <Swords className="w-10 h-10 text-muted-foreground/40 mx-auto" />
        <p className="text-sm text-muted-foreground">Game not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back + header */}
      <div className="space-y-3">
        <button
          onClick={() => navigate(`/league/${code}/gameweeks/${slug}`)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to gameweek
        </button>

        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-primary shrink-0" />
              <h1 className="text-2xl font-black tracking-tight">
                {game ? `${game.homeTeamName ?? '—'} vs ${game.awayTeamName ?? '—'}` : '…'}
              </h1>
            </div>
          </div>
          {status && (
            <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
          )}
        </div>
      </div>

      {/* Loading state */}
      {(gameLoading || picksLoading) && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Game card */}
      {game && !picksLoading && <GameHeader game={game} />}

      {/* Open: squad picker */}
      {game && isOpen && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your squad</h2>
          <div className="space-y-2">
            {SLOTS.map((slot, i) => (
              <SquadSlotRow
                key={slot.id}
                slot={slot}
                player={draftPicks[i]}
                isOpen
                onTap={() => setActiveSlotIndex(i)}
                onClear={() => setDraftPicks(prev => prev.map((p, j) => j === i ? null : p))}
              />
            ))}
          </div>

          {saveError && (
            <p className="text-xs text-red-400 text-center">{saveError}</p>
          )}

          <button
            disabled={!allFilled || !isDirty || saving}
            onClick={savePicks}
            className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            {saving ? 'Saving…' : savedPicks ? 'Update picks' : 'Save picks'}
          </button>
        </section>
      )}

      {/* Finished/Live with picks: read-only squad */}
      {game && isClosedWithPicks && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your squad</h2>
          <div className="space-y-2">
            {SLOTS.map((slot, i) => (
              <SquadSlotRow
                key={slot.id}
                slot={slot}
                player={draftPicks[i]}
                isOpen={false}
              />
            ))}
          </div>
        </section>
      )}

      {/* Finished/Live without picks */}
      {game && isClosedNoPicks && (
        <div className="rounded-xl border border-border/30 bg-muted/10 px-4 py-4 text-center">
          <p className="text-sm text-muted-foreground">You didn't submit picks for this game.</p>
        </div>
      )}

      {/* Player picker dialog */}
      {activeSlotIndex !== null && allPlayers && (
        <PlayerPickerDialog
          slot={SLOTS[activeSlotIndex]}
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
