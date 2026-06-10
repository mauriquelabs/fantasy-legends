import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  Loader2, Mail, CheckCircle, Trophy, Users, Zap, BarChart2,
  CreditCard, Swords, Globe, ClipboardList, Star,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCountdown } from '@/lib/countdown';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeagueInfo {
  code: string;
  name: string;
  draftAt: string | null;
  memberCount: number;
}

type PageState = 'loading' | 'notFound' | 'form' | 'sending' | 'sent' | 'joining' | 'alreadyAuthed';

// ── Countdown ─────────────────────────────────────────────────────────────────

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-[3rem]">
      <span
        className="text-4xl sm:text-6xl font-black tabular-nums leading-none"
        style={{ fontFamily: "'Space Mono', monospace", color: '#00d4b4' }}
      >
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[9px] sm:text-[11px] uppercase tracking-widest text-white/40 mt-2">
        {label}
      </span>
    </div>
  );
}

function DraftCountdown({ draftAt }: { draftAt: string | null }) {
  const target = draftAt ? new Date(draftAt) : null;
  const countdown = useCountdown(target);

  if (!countdown) {
    return (
      <p className="text-sm text-white/40 uppercase tracking-widest">
        Draft date to be announced
      </p>
    );
  }

  if (countdown.past) {
    return (
      <p
        className="text-xl font-black uppercase tracking-widest"
        style={{ fontFamily: "'Space Mono', monospace", color: '#00d4b4' }}
      >
        The draft has started! 🚀
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 text-center">
        Opening day in
      </p>
      <div className="flex items-end justify-center gap-3 sm:gap-5">
        <CountdownUnit value={countdown.days} label="days" />
        <span className="text-3xl font-black text-white/20 mb-1">:</span>
        <CountdownUnit value={countdown.hours} label="hours" />
        <span className="text-3xl font-black text-white/20 mb-1">:</span>
        <CountdownUnit value={countdown.minutes} label="min" />
        <span className="text-3xl font-black text-white/20 mb-1">:</span>
        <CountdownUnit value={countdown.seconds} label="sec" />
      </div>
    </div>
  );
}

// ── Join CTA ──────────────────────────────────────────────────────────────────

interface JoinCtaProps {
  pageState: PageState;
  league: LeagueInfo | null;
  email: string;
  errorMsg: string;
  session: Session | null;
  onEmailChange: (v: string) => void;
  onMagicLink: (e: React.FormEvent) => void;
  onJoinExisting: () => void;
  onChangeEmail: () => void;
  autoFocus?: boolean;
}

function JoinCta({
  pageState, league, email, errorMsg, session,
  onEmailChange, onMagicLink, onJoinExisting, onChangeEmail, autoFocus = true,
}: JoinCtaProps) {
  const inputClass =
    "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 transition-all";
  const btnPrimary =
    "w-full flex items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-sm font-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]";

  if (pageState === 'loading') {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-white/30" />
      </div>
    );
  }

  if (pageState === 'notFound') return null;

  if (pageState === 'sent') {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
          style={{ background: 'rgba(0,212,180,0.1)' }}>
          <Mail className="w-7 h-7" style={{ color: '#00d4b4' }} />
        </div>
        <div className="space-y-1">
          <p className="font-black text-lg" style={{ fontFamily: "'Space Mono', monospace" }}>
            Check your inbox
          </p>
          <p className="text-sm text-white/50">
            Magic link sent to{' '}
            <span className="font-semibold text-white">{email}</span>.
            Click it to join the league.
          </p>
        </div>
        <button
          onClick={onChangeEmail}
          className="text-xs text-white/30 underline underline-offset-2 hover:text-white/60 transition-colors"
        >
          Use a different email
        </button>
      </div>
    );
  }

  if (pageState === 'alreadyAuthed' || pageState === 'joining') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-white/50 rounded-lg px-3 py-2.5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
          <span>Signed in as <span className="font-semibold text-white">{session?.user.email}</span></span>
        </div>
        {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
        <button
          onClick={onJoinExisting}
          disabled={pageState === 'joining'}
          className={btnPrimary}
          style={{ background: '#00d4b4', color: '#000' }}
        >
          {pageState === 'joining' && <Loader2 className="w-4 h-4 animate-spin" />}
          {pageState === 'joining' ? 'Joining…' : `Join ${league?.name ?? 'League'}`}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onMagicLink} className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={e => onEmailChange(e.target.value)}
        placeholder="Enter your email to join"
        required
        disabled={pageState === 'sending'}
        className={inputClass}
        style={{ '--tw-ring-color': '#00d4b4' } as React.CSSProperties}
        autoFocus={autoFocus}
      />
      {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
      <button
        type="submit"
        disabled={pageState === 'sending'}
        className={btnPrimary}
        style={{ background: '#00d4b4', color: '#000' }}
      >
        {pageState === 'sending' && <Loader2 className="w-4 h-4 animate-spin" />}
        {pageState === 'sending' ? 'Sending link…' : '⚡ Join the league'}
      </button>
      <p className="text-xs text-center text-white/25">
        Magic link — no password needed
      </p>
    </form>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    icon: Globe,
    title: 'Scout all 48 squads',
    desc: 'Browse every World Cup 2026 squad with live Sorare stats and player form.',
  },
  {
    icon: ClipboardList,
    title: 'Draft your team',
    desc: 'Pick your players before the tournament kicks off and lock in your lineup.',
  },
  {
    icon: Swords,
    title: 'Compete with friends',
    desc: 'Track live scores and climb the league table as the group stage unfolds.',
  },
];

// ── Features ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Zap,
    color: '#f5c518',
    title: 'Live fixtures & scores',
    desc: 'Real-time World Cup results as they happen.',
  },
  {
    icon: BarChart2,
    color: '#00d4b4',
    title: 'Player scouting',
    desc: 'Form sparklines and stats to find hidden gems.',
  },
  {
    icon: CreditCard,
    color: '#9b59b6',
    title: 'Sorare card depth',
    desc: "Deep-links to every player's Sorare card profile.",
  },
  {
    icon: Trophy,
    color: '#f5c518',
    title: 'Private draft room',
    desc: 'Invite-only league with a live draft experience.',
  },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function JoinLeague() {
  const { code } = useParams<{ code: string }>();
  const [, navigate] = useLocation();
  const { session, loading: authLoading } = useAuth();

  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Delay one tick so the browser paints the initial opacity:0/translateY
    // state before flipping mounted=true, ensuring CSS transitions actually fire.
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/leagues/${code}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setPageState('notFound'); return; }
        setLeague(data);
        setPageState(authLoading ? 'loading' : session ? 'alreadyAuthed' : 'form');
      })
      .catch(() => setPageState('notFound'));
  }, [code]);

  useEffect(() => {
    if (pageState === 'loading' && !authLoading && league) {
      setPageState(session ? 'alreadyAuthed' : 'form');
    }
  }, [authLoading, session, league, pageState]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setPageState('sending');

    const returnTo = `/auth/set-password?leagueCode=${code}`;
    const emailRedirectTo = `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo },
    });

    if (error) {
      setErrorMsg(error.message);
      setPageState('form');
    } else {
      setPageState('sent');
    }
  };

  const handleJoinExisting = async () => {
    if (!code || !session) return;
    setPageState('joining');
    setErrorMsg('');
    try {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      const res = await fetch(`/api/leagues/${code}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${freshSession?.access_token}` },
      });
      if (!res.ok) throw new Error(`Join failed (${res.status})`);
      navigate(`/league/${code}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setPageState('alreadyAuthed');
    }
  };

  const ctaProps = {
    pageState,
    league,
    email,
    errorMsg,
    session,
    onEmailChange: setEmail,
    onMagicLink: handleMagicLink,
    onJoinExisting: handleJoinExisting,
    onChangeEmail: () => setPageState('form'),
  };

  const fadeUp = (delay = 0): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(24px)',
    transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
  });

  return (
    <div className="min-h-screen dark" style={{ background: '#090909', color: '#f5f5f5' }}>

      {/* ── HERO ── */}
      <section
        className="relative flex flex-col items-center justify-center px-4 py-16 sm:py-24 overflow-hidden"
        style={{ minHeight: '100svh' }}
      >
        {/* Animated background glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 70% 50% at 50% 0%, rgba(0,212,180,0.12) 0%, transparent 70%),
              radial-gradient(ellipse 40% 30% at 80% 80%, rgba(245,197,24,0.07) 0%, transparent 60%)
            `,
          }}
        />
        {/* Subtle grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col items-center text-center gap-8">

          {/* Brand lockup */}
          <div style={fadeUp(0)} className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">⚽</span>
              <span
                className="text-sm font-black uppercase tracking-[0.2em] text-white/40"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                Fantasy Legends
              </span>
              <span className="text-2xl">🏆</span>
            </div>
            <p
              className="text-xs uppercase tracking-[0.3em]"
              style={{ color: '#00d4b4', fontFamily: "'Space Mono', monospace" }}
            >
              World Cup 2026 Draft
            </p>
          </div>

          {/* League name or loading/not-found states */}
          <div style={fadeUp(100)} className="space-y-3">
            {pageState === 'loading' && !league && (
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-white/20" />
            )}

            {pageState === 'notFound' && (
              <div className="space-y-3">
                <h1
                  className="text-3xl sm:text-4xl font-black leading-tight"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  Invite not found
                </h1>
                <p className="text-white/40 text-sm">
                  This invite link may have expired or is invalid.
                </p>
              </div>
            )}

            {league && (
              <>
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
                  style={{ background: 'rgba(0,212,180,0.1)', color: '#00d4b4', border: '1px solid rgba(0,212,180,0.2)' }}
                >
                  <Users className="w-3.5 h-3.5" />
                  {league.memberCount} {league.memberCount === 1 ? 'member' : 'members'} already in
                </div>
                <h1
                  className="text-3xl sm:text-5xl font-black leading-tight tracking-tight"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {league.name}
                </h1>
                <p className="text-white/40 text-sm">
                  You've been invited to join this private World Cup 2026 fantasy league.
                </p>
              </>
            )}
          </div>

          {/* Countdown */}
          {league && (
            <div style={fadeUp(200)}>
              <DraftCountdown draftAt={league.draftAt} />
            </div>
          )}

          {/* CTA card */}
          {league && pageState !== 'notFound' && (
            <div
              style={{
                ...fadeUp(300),
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(12px)',
                borderRadius: '1rem',
                padding: '1.5rem',
                width: '100%',
              }}
            >
              <JoinCta {...ctaProps} />
            </div>
          )}

          {/* Star ratings / social proof */}
          {league && pageState !== 'notFound' && (
            <div style={fadeUp(400)} className="flex items-center gap-1.5 text-xs text-white/25">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-current" style={{ color: '#f5c518' }} />
              ))}
              <span>Trusted by WC fantasy fans worldwide</span>
            </div>
          )}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        className="px-4 py-20 sm:py-24"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <p
              className="text-xs font-black uppercase tracking-[0.25em] text-white/30"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              How it works
            </p>
            <h2
              className="text-2xl sm:text-3xl font-black leading-tight"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              Three steps to glory
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {HOW_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="flex flex-col items-center text-center gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,212,180,0.1)', border: '1px solid rgba(0,212,180,0.15)' }}
                  >
                    <Icon className="w-6 h-6" style={{ color: '#00d4b4' }} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-center gap-2">
                      <span
                        className="text-xs font-black"
                        style={{ color: '#00d4b4', fontFamily: "'Space Mono', monospace" }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3 className="font-black text-base">{step.title}</h3>
                    </div>
                    <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FEATURE HIGHLIGHTS ── */}
      <section
        className="px-4 py-20 sm:py-24"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)' }}
      >
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <p
              className="text-xs font-black uppercase tracking-[0.25em] text-white/30"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              Everything you need
            </p>
            <h2
              className="text-2xl sm:text-3xl font-black leading-tight"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              Built for the World Cup
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div
                  key={i}
                  className="rounded-xl p-5 space-y-3 transition-colors hover:bg-white/5"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${feat.color}15`, border: `1px solid ${feat.color}25` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: feat.color }} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-sm">{feat.title}</h3>
                    <p className="text-xs text-white/40 leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      {league && pageState !== 'notFound' && (
        <section
          className="px-4 py-20 sm:py-24"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(0,212,180,0.08) 0%, transparent 70%)',
          }}
        >
          <div className="max-w-md mx-auto text-center space-y-8">
            <div className="space-y-3">
              <span className="text-4xl">🏆</span>
              <h2
                className="text-2xl sm:text-3xl font-black leading-tight"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                Join {league.name}
              </h2>
              <p className="text-white/40 text-sm">
                Don't miss your spot — secure your place before the draft begins.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '1rem',
                padding: '1.5rem',
              }}
            >
              <JoinCta {...ctaProps} autoFocus={false} />
            </div>
          </div>
        </section>
      )}

      {/* ── FOOTER ── */}
      <footer
        className="px-4 py-8 text-center"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <p className="text-xs text-white/20">
          ⚽ Fantasy Legends · World Cup 2026 · Powered by Sorare
        </p>
      </footer>
    </div>
  );
}
