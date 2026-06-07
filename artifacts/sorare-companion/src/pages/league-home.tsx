import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { Loader2, Trophy, Users, Link2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import WorldCupHome from './world-cup-home';

interface LeagueInfo {
  id: number;
  code: string;
  name: string;
  draftAt: string | null;
  memberCount: number;
}

// ── Draft countdown ────────────────────────────────────────────────────────────

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return null;
  const ms = target.getTime() - now;
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    past: false,
  };
}

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

function DraftCountdown({ draftAt }: { draftAt: string | null }) {
  const target = draftAt ? new Date(draftAt) : null;
  const countdown = useCountdown(target);

  return (
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
    </div>
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

  // Redirect to join page if not authenticated
  useEffect(() => {
    if (!authLoading && !session) {
      navigateRef.current(`/join/${code}`);
    }
  }, [authLoading, session, code]);

  // Fetch league info + register membership
  useEffect(() => {
    if (!code || authLoading || !session) return;

    fetch(`/api/leagues/${code}`)
      .then(r => r.ok ? r.json() : null)
      .then(async data => {
        if (!data) { setPageState('notFound'); return; }
        setLeague(data);
        setPageState('ready');

        // Idempotent join — records this user as a member
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
    <div className="space-y-8">
      {/* League header */}
      <div className="space-y-4">
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
        <DraftCountdown draftAt={league?.draftAt ?? null} />
      </div>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Full world cup content */}
      <WorldCupHome />
    </div>
  );
}
