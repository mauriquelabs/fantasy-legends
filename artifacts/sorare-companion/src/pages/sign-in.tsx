import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Loader2, Mail, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

type Mode = 'signin' | 'signup' | 'magic' | 'reset';
type State = 'idle' | 'loading' | 'sent' | 'error';

const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50";
const btnClass = "w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

const REMEMBERED_EMAIL_KEY = 'auth:rememberedEmail';

export default function SignIn() {
  const { session, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>(() => {
    const m = new URLSearchParams(window.location.search).get('mode');
    return (m === 'signin' || m === 'signup' || m === 'magic' || m === 'reset') ? m : 'signin';
  });
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const raw = new URLSearchParams(window.location.search).get('returnTo') ?? '/world-cup';
  const returnTo = (() => {
    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin !== window.location.origin) return '/world-cup';
      return url.pathname + url.search + url.hash || '/world-cup';
    } catch {
      return '/world-cup';
    }
  })();

  useEffect(() => {
    if (!authLoading && session) navigate(returnTo);
  }, [session, authLoading, navigate, returnTo]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrorMsg('');
    setState('idle');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');
    setErrorMsg('');
    localStorage.setItem(REMEMBERED_EMAIL_KEY, email);

    if (mode === 'magic') {
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const callbackUrl = `${window.location.origin}${base}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl },
      });
      if (error) { setErrorMsg(error.message); setState('error'); }
      else setState('sent');
      return;
    }

    if (mode === 'reset') {
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${base}/auth/reset-password`,
      });
      if (error) { setErrorMsg(error.message); setState('error'); }
      else setState('sent');
      return;
    }

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setErrorMsg(error.message); setState('error'); }
      else { setState('idle'); navigate(returnTo); }
      return;
    }

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setErrorMsg(error.message);
        setState('error');
      } else if (data.user && data.user.identities?.length === 0) {
        setErrorMsg('An account with this email already exists. Sign in instead.');
        setState('error');
      } else {
        setState('sent');
      }
    }
  };

  if (authLoading) return null;

  if (state === 'sent') {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-4 max-w-sm mx-auto">
        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="w-7 h-7 text-green-500" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'reset'
              ? <>We sent a password reset link to <span className="font-medium text-foreground">{email}</span>.</>
              : <>We sent a magic link to <span className="font-medium text-foreground">{email}</span>.</>}
          </p>
        </div>
        <button onClick={() => switchMode('signin')} className="text-sm text-muted-foreground underline underline-offset-2">
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-32 max-w-sm mx-auto space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in'}
        </h1>
        {mode === 'reset' && (
          <p className="text-sm text-muted-foreground">Enter your email and we'll send a reset link.</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={state === 'loading'}
          className={inputClass}
        />
        {mode !== 'magic' && mode !== 'reset' && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'Choose a password (min 8 chars)' : 'Password'}
            required
            minLength={mode === 'signup' ? 8 : undefined}
            disabled={state === 'loading'}
            className={inputClass}
          />
        )}
        {state === 'error' && <p className="text-sm text-destructive">{errorMsg}</p>}
        <button type="submit" disabled={state === 'loading'} className={btnClass}>
          {state === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
          {state === 'loading'
            ? 'Please wait…'
            : mode === 'signup' ? 'Create account'
            : mode === 'magic' ? 'Send magic link'
            : mode === 'reset' ? 'Send reset link'
            : 'Sign in'}
        </button>
      </form>

      <div className="w-full space-y-2 text-center text-sm text-muted-foreground">
        {mode === 'signin' && (
          <>
            <p>
              <button onClick={() => switchMode('reset')} className="hover:text-foreground transition-colors">
                Forgot password?
              </button>
            </p>
            <p>
              No account?{' '}
              <button onClick={() => switchMode('signup')} className="text-foreground underline underline-offset-2 hover:text-primary">
                Sign up
              </button>
            </p>
            <p>
              <button onClick={() => switchMode('magic')} className="flex items-center gap-1.5 mx-auto hover:text-foreground transition-colors">
                <Mail className="w-3.5 h-3.5" /> Send me a magic link instead
              </button>
            </p>
          </>
        )}
        {mode === 'signup' && (
          <p>
            Already have an account?{' '}
            <button onClick={() => switchMode('signin')} className="text-foreground underline underline-offset-2 hover:text-primary">
              Sign in
            </button>
          </p>
        )}
        {mode === 'magic' && (
          <p>
            <button onClick={() => switchMode('signin')} className="hover:text-foreground transition-colors">
              Use password instead
            </button>
          </p>
        )}
        {mode === 'reset' && (
          <p>
            <button onClick={() => switchMode('signin')} className="hover:text-foreground transition-colors">
              Back to sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
