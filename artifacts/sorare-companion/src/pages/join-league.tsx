import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Loader2, Mail, CheckCircle, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface LeagueInfo {
  code: string;
  name: string;
  draftAt: string | null;
  memberCount: number;
}

const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50";
const btnClass = "w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

type PageState = 'loading' | 'notFound' | 'form' | 'sending' | 'sent' | 'joining' | 'alreadyAuthed';

export default function JoinLeague() {
  const { code } = useParams<{ code: string }>();
  const [, navigate] = useLocation();
  const { session, loading: authLoading } = useAuth();

  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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
    try {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      await fetch(`/api/leagues/${code}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${freshSession?.access_token}` },
      });
      navigate(`/league/${code}`);
    } catch {
      setPageState('alreadyAuthed');
    }
  };

  const draftLabel = (() => {
    if (!league?.draftAt) return null;
    return new Date(league.draftAt).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });
  })();

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Brand */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Trophy className="w-7 h-7 text-primary" />
            <span className="text-xl font-black tracking-tight">Fantasy Legends</span>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">World Cup 2026 Draft</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-6">

          {pageState === 'loading' && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {pageState === 'notFound' && (
            <div className="text-center space-y-2 py-4">
              <p className="font-semibold">League not found</p>
              <p className="text-sm text-muted-foreground">This invite link may have expired or is invalid.</p>
            </div>
          )}

          {(pageState === 'form' || pageState === 'sending') && league && (
            <>
              <div className="space-y-1.5">
                <h1 className="text-2xl font-black tracking-tight">{league.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {league.memberCount} {league.memberCount === 1 ? 'member' : 'members'} joined
                  {draftLabel ? ` · Draft on ${draftLabel}` : ' · Draft date TBD'}
                </p>
              </div>
              <form onSubmit={handleMagicLink} className="space-y-3">
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
                    disabled={pageState === 'sending'}
                    className={inputClass}
                    autoFocus
                  />
                </div>
                {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
                <button type="submit" disabled={pageState === 'sending'} className={btnClass}>
                  {pageState === 'sending' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {pageState === 'sending' ? 'Sending link…' : 'Join with email'}
                </button>
              </form>
              <p className="text-xs text-center text-muted-foreground/60">
                We'll send you a magic link — no password needed to get started.
              </p>
            </>
          )}

          {pageState === 'sent' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Mail className="w-7 h-7 text-primary" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold">Check your inbox</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a link to <span className="font-medium text-foreground">{email}</span>.
                  Click it to set your password and join the draft.
                </p>
              </div>
              <button
                onClick={() => setPageState('form')}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Use a different email
              </button>
            </div>
          )}

          {(pageState === 'alreadyAuthed' || pageState === 'joining') && league && (
            <>
              <div className="space-y-1.5">
                <h1 className="text-2xl font-black tracking-tight">{league.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {league.memberCount} {league.memberCount === 1 ? 'member' : 'members'} joined
                  {draftLabel ? ` · Draft on ${draftLabel}` : ' · Draft date TBD'}
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg bg-muted/30 px-3 py-2.5">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  <span>Signed in as <span className="font-medium text-foreground">{session?.user.email}</span></span>
                </div>
                <button
                  onClick={handleJoinExisting}
                  disabled={pageState === 'joining'}
                  className={btnClass}
                >
                  {pageState === 'joining' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {pageState === 'joining' ? 'Joining…' : `Join ${league.name}`}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
