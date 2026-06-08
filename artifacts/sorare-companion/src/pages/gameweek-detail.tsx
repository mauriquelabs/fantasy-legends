import { useState, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Calendar, Loader2, Search, Shield, Star, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useGameweeks,
  useMyPicks,
  useGameweekTopPlayers,
  useGameweekGames,
  usePlayers,
  type DbPlayer,
  type GameweekFixture,
  type GameweekGame,
} from '@/hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Slot {
  id: string;
  label: string;
  position: string | null; // null = FLEX (any non-GK)
}

const SLOTS: Slot[] = [
  { id: 'gk',   label: 'GK',   position: 'Goalkeeper' },
  { id: 'def',  label: 'DEF',  position: 'Defender' },
  { id: 'mid',  label: 'MID',  position: 'Midfielder' },
  { id: 'fwd',  label: 'FWD',  position: 'Forward' },
  { id: 'flex', label: 'FLEX', position: null },
];

function gwStatus(gw: GameweekFixture): 'open' | 'live' | 'finished' {
  const now = Date.now();
  const start = new Date(gw.startDate).getTime();
  const end = new Date(gw.endDate).getTime();
  if (now < start) return 'open';
  if (now <= end) return 'live';
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
  onSelect,
  onClose,
}: {
  slot: Slot;
  players: DbPlayer[];
  onSelect: (player: DbPlayer) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');

  const eligible = useMemo(() => {
    const filtered = players.filter(p => matchesSlot(p, slot));
    const searched = q.trim()
      ? filtered.filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
      : filtered;
    return searched.sort((a, b) => (b.avg5Score ?? 0) - (a.avg5Score ?? 0));
  }, [players, slot, q]);

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

        <div className="overflow-y-auto max-h-72 divide-y divide-border/40 px-1 pb-2">
          {eligible.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No players found.</p>
          ) : (
            eligible.map(p => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {p.currentClub ?? p.teamName ?? '—'}
                  </p>
                </div>
                {p.avg5Score != null && (
                  <span className="shrink-0 text-xs font-bold text-primary tabular-nums">
                    {p.avg5Score.toFixed(0)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Squad section ─────────────────────────────────────────────────────────────

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

      {player ? (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{player.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {player.currentClub ?? player.teamName ?? '—'}
          </p>
        </div>
      ) : (
        <p className="flex-1 text-sm text-muted-foreground/60 italic">
          {isOpen ? `+ Pick ${slot.label}` : 'No player selected'}
        </p>
      )}

      {player && player.avg5Score != null && (
        <span className="shrink-0 text-xs font-bold text-primary tabular-nums">
          {player.avg5Score.toFixed(0)}
        </span>
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

// ── Games section ─────────────────────────────────────────────────────────────

function gameStatus(utcDate: string): 'scheduled' | 'live' | 'finished' {
  const kick = new Date(utcDate).getTime();
  const now = Date.now();
  const elapsed = (now - kick) / 60000;
  if (elapsed < 0) return 'scheduled';
  if (elapsed < 150) return 'live';
  return 'finished';
}

function GameRow({ game }: { game: GameweekGame }) {
  const status = gameStatus(game.utcDate);
  const kickoff = new Date(game.utcDate).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const date = new Date(game.utcDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-card/40 px-4 py-3">
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

      <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
        <span className="text-sm font-semibold truncate text-right">{game.awayTeamName ?? '—'}</span>
        {game.awayTeamCrest ? (
          <img src={game.awayTeamCrest} alt="" className="w-5 h-5 object-contain shrink-0" />
        ) : (
          <Shield className="w-5 h-5 text-muted-foreground/30 shrink-0" />
        )}
      </div>
    </div>
  );
}

function GamesSection({ gw }: { gw: GameweekFixture }) {
  const { data: gwGames, isLoading } = useGameweekGames(gw.slug, gw.startDate, gw.endDate);

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
          {gwGames.map(g => <GameRow key={g.sorareId} game={g} />)}
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
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const { data: gameweeks } = useGameweeks();
  const gw = gameweeks?.find(g => g.slug === slug) ?? null;

  const { data: picks, isLoading: picksLoading } = useMyPicks(code, slug, session);
  const { data: allPlayers } = usePlayers();

  const [draftPicks, setDraftPicks] = useState<(DbPlayer | null)[]>(() => Array(5).fill(null));
  const [picksInitialized, setPicksInitialized] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const status = gw ? gwStatus(gw) : null;
  const isOpen = status === 'open';
  const isClosedWithPicks = (status === 'live' || status === 'finished') && !!picks;
  const isClosedNoPicks = (status === 'live' || status === 'finished') && !picks && !picksLoading;

  // Hydrate draft picks from saved picks once players are loaded
  if (!picksInitialized && picks && allPlayers?.length) {
    const playerMap = new Map(allPlayers.map(p => [p.id, p]));
    const hydrated = picks.playerIds.map(id => playerMap.get(id) ?? null);
    const padded = [...hydrated, ...Array(5).fill(null)].slice(0, 5);
    setDraftPicks(padded);
    setPicksInitialized(true);
  }

  const isDirty = useMemo(() => {
    if (!picks) return draftPicks.some(p => p !== null);
    const savedIds = picks.playerIds;
    const draftIds = draftPicks.map(p => p?.id ?? null);
    return !savedIds.every((id, i) => id === draftIds[i]);
  }, [picks, draftPicks]);

  const allFilled = draftPicks.every(p => p !== null);

  async function savePicks() {
    if (!session || !allFilled) return;
    setSaving(true);
    setSaveError(null);
    try {
      const playerIds = draftPicks.map(p => p!.id);
      const res = await fetch(`/api/leagues/${code}/picks/${slug}`, {
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
      queryClient.invalidateQueries({ queryKey: ['api', 'picks', code, slug] });
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

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
      {(!gw || picksLoading) && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Matches — always visible */}
      {gw && !picksLoading && <GamesSection gw={gw} />}

      {/* Open: squad picker */}
      {gw && isOpen && (
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
            {saving ? 'Saving…' : picks ? 'Update picks' : 'Save picks'}
          </button>
        </section>
      )}

      {/* Finished/Live with picks: read-only squad + top players */}
      {gw && isClosedWithPicks && (
        <>
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
          <TopPlayersSection gameweekSlug={slug} />
        </>
      )}

      {/* Finished/Live without picks: just top players */}
      {gw && isClosedNoPicks && (
        <>
          <div className="rounded-xl border border-border/30 bg-muted/10 px-4 py-4 text-center">
            <p className="text-sm text-muted-foreground">You didn't submit picks for this gameweek.</p>
          </div>
          <TopPlayersSection gameweekSlug={slug} />
        </>
      )}

      {/* Player picker dialog */}
      {activeSlotIndex !== null && allPlayers && (
        <PlayerPickerDialog
          slot={SLOTS[activeSlotIndex]}
          players={allPlayers}
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
