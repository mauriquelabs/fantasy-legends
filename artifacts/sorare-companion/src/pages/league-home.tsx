import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { Loader2, Trophy, Users, Link2, Check, Calendar, ChevronRight, Medal } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useGameweeks, useLeagueScoreboard, type GameweekFixture } from '@/hooks/useApi';
import { useCountdown } from '@/lib/countdown';

interface LeagueInfo {
  id: number;
  code: string;
  name: string;
  draftAt: string | null;
  memberCount: number;
}

// ── Draft countdown ────────────────────────────────────────────────────────────

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-3xl sm:text-5xl font-black tabular-nums leading-none text-primary">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground mt-1.5">
        {label}
      </span>
    </div>
  );
}

function DraftCountdown({ draftAt }: { draftAt: string }) {
  const target = new Date(draftAt);
  const countdown = useCountdown(target);
  const isDraftLeague = false;

  return (
    isDraftLeague ?
      <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-5 sm:px-8 sm:py-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 text-center">
          Draft starts in
        </p>
        {countdown ? (
          countdown.past ? (
            <p className="text-center text-sm font-bold text-primary">The draft has started!</p>
          ) : (
            <div className="flex items-end justify-center gap-3 sm:gap-5">
              <CountdownUnit value={countdown.days} label="days" />
              <span className="text-2xl font-black text-muted-foreground/40 mb-1">:</span>
              <CountdownUnit value={countdown.hours} label="hours" />
              <span className="text-2xl font-black text-muted-foreground/40 mb-1">:</span>
              <CountdownUnit value={countdown.minutes} label="min" />
              <span className="text-2xl font-black text-muted-foreground/40 mb-1">:</span>
              <CountdownUnit value={countdown.seconds} label="sec" />
            </div>
          )
        ) : (
          <p className="text-center text-sm text-muted-foreground">Draft date to be announced</p>
        )}
      </div> : null
  );
}

// ── Gameweeks ──────────────────────────────────────────────────────────────────

function gameweekStatus(gw: GameweekFixture): { label: string; className: string } {
  const now = Date.now();
  const start = new Date(gw.startDate).getTime();
  const end = new Date(gw.endDate).getTime();
  if (now < start) return { label: 'Open', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  if (now <= end) return { label: 'Live', className: 'bg-red-500/15 text-red-400 border-red-500/30 animate-pulse' };
  return { label: 'Finished', className: 'bg-muted/20 text-muted-foreground border-border/40' };
}

function GameweekCard({ gw, leagueCode }: { gw: GameweekFixture; leagueCode: string }) {
  const status = gameweekStatus(gw);
  const start = new Date(gw.startDate);
  const end = new Date(gw.endDate);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const label = gw.slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Link href={`/league/${leagueCode}/gameweeks/${gw.slug}`}>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-card/60 px-4 py-3.5 hover:border-primary/40 hover:bg-card transition-all cursor-pointer">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-muted/20 shrink-0">
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{fmt(start)} – {fmt(end)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.className}`}>
            {status.label}
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
        </div>
      </div>
    </Link>
  );
}

function Gameweeks({ leagueCode }: { leagueCode: string }) {
  const { data: gameweeks, isLoading, isError } = useGameweeks();

  const sorted = gameweeks
    ? [...gameweeks].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    : [];

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Gameweeks</h2>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : isError || !sorted.length ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No upcoming gameweeks.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map(gw => <GameweekCard key={gw.slug} gw={gw} leagueCode={leagueCode} />)}
        </div>
      )}
    </section>
  );
}

// ── Scoreboard ────────────────────────────────────────────────────────────────

const MEDAL_COLORS = ['text-yellow-400', 'text-slate-400', 'text-amber-600'];

function Scoreboard({ leagueCode, currentUserId }: { leagueCode: string; currentUserId: string }) {
  const { session } = useAuth();
  const { data: members, isLoading } = useLeagueScoreboard(leagueCode, session);

  const displayName = (email: string | null) => {
    if (!email) return 'Anonymous';
    return email.split('@')[0];
  };

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Scoreboard</h2>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : !members?.length ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No members yet.</p>
      ) : (
        <div className="space-y-2">
          {members.map((member, i) => {
            const isMe = member.userId === currentUserId;
            return (
              <div
                key={member.userId}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  isMe
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/50 bg-card/60'
                }`}
              >
                <span className={`w-5 text-sm font-black tabular-nums shrink-0 ${MEDAL_COLORS[i] ?? 'text-muted-foreground'}`}>
                  {i + 1}
                </span>
                {i < 3 && <Medal className={`w-3.5 h-3.5 shrink-0 ${MEDAL_COLORS[i]}`} />}
                {i >= 3 && <div className="w-3.5 shrink-0" />}
                <span className={`text-sm font-medium flex-1 truncate ${isMe ? 'text-primary' : ''}`}>
                  {displayName(member.email)}
                  {isMe && <span className="ml-1.5 text-[10px] font-bold text-primary/60">you</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeagueHome() {
  const { code } = useParams<{ code: string }>();
  const [, navigate] = useLocation();
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; });

  const { session, loading: authLoading } = useAuth();
  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [pageState, setPageState] = useState<'loading' | 'ready' | 'notFound'>('loading');
  const [copied, setCopied] = useState(false);

  const copyInviteLink = () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    navigator.clipboard.writeText(`${window.location.origin}${base}/join/${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!authLoading && !session) {
      navigateRef.current(`/join/${code}`);
    }
  }, [authLoading, session, code]);

  useEffect(() => {
    if (!code || authLoading || !session) return;

    fetch(`/api/leagues/${code}`)
      .then(r => r.ok ? r.json() : null)
      .then(async data => {
        if (!data) { setPageState('notFound'); return; }
        setLeague(data);
        setPageState('ready');

        await fetch(`/api/leagues/${code}/join`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      })
      .catch(() => setPageState('notFound'));
  }, [code, authLoading, session]);

  if (authLoading || pageState === 'loading') {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pageState === 'notFound') {
    return (
      <div className="flex flex-col items-center py-32 text-center space-y-3 max-w-sm mx-auto">
        <Trophy className="w-10 h-10 text-muted-foreground/40" />
        <h1 className="text-lg font-semibold">League not found</h1>
        <p className="text-sm text-muted-foreground">This league doesn't exist or you don't have access.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* League header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-2xl font-black tracking-tight">{league?.name}</h1>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{league?.memberCount} {league?.memberCount === 1 ? 'member' : 'members'}</span>
          </div>
        </div>
        <button
          onClick={copyInviteLink}
          className="flex items-center gap-1.5 shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Link2 className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Invite link'}
        </button>
      </div>

      {/* Draft countdown */}
      {league?.draftAt && <DraftCountdown draftAt={league.draftAt} />}

      {/* Scoreboard */}
      {session && <Scoreboard leagueCode={code} currentUserId={session.user.id} />}

      {/* Gameweeks */}
      <Gameweeks leagueCode={code} />
    </div>
  );
}
