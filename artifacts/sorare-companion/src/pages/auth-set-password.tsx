import { useState, useEffect, useRef } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type State = 'loading' | 'ready' | 'submitting' | 'success' | 'error';

const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50";
const btnClass = "w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export default function AuthSetPassword() {
  const [, navigate] = useLocation();
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; });

  const search = useSearch();
  const leagueCode = new URLSearchParams(search).get('leagueCode');
  const destination = leagueCode ? `/league/${leagueCode}` : '/world-cup';

  const [state, setState] = useState<State>('loading');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let sub: ReturnType<typeof supabase.auth.onAuthStateChange>['data']['subscription'] | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setState('ready');
      } else {
        const { data } = supabase.auth.onAuthStateChange((event, s) => {
          if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && s) {
            setState('ready');
            data.subscription.unsubscribe();
          }
        });
        sub = data.subscription;
        timeout = setTimeout(() => {
          data.subscription.unsubscribe();
          navigateRef.current(leagueCode ? `/join/${leagueCode}` : '/sign-in');
        }, 15_000);
      }
    });

    return () => {
      sub?.unsubscribe();
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('submitting');
    setErrorMsg('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMsg(error.message);
      setState('ready');
    } else {
      setState('success');
      setTimeout(() => navigateRef.current(destination), 1200);
    }
  };

  const handleSkip = () => navigateRef.current(destination);

  if (state === 'loading') {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-4 max-w-sm mx-auto">
        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="w-7 h-7 text-green-500" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">You're in!</h1>
          <p className="text-sm text-muted-foreground">Taking you to the league…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 dark bg-background text-foreground">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black tracking-tight">Set your password</h1>
          <p className="text-sm text-muted-foreground">
            Choose a password so you can sign in next time.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            required
            minLength={8}
            disabled={state === 'submitting'}
            className={inputClass}
            autoFocus
          />
          {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
          <button type="submit" disabled={state === 'submitting'} className={btnClass}>
            {state === 'submitting' && <Loader2 className="w-4 h-4 animate-spin" />}
            {state === 'submitting' ? 'Saving…' : 'Set password & continue'}
          </button>
        </form>
        <button
          onClick={handleSkip}
          className="w-full text-xs text-center text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-2"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
