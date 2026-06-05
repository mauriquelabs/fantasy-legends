import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Mail, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

type State = 'idle' | 'loading' | 'sent' | 'error';

export default function SignIn() {
  const { session, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const raw = new URLSearchParams(window.location.search).get('returnTo') ?? '/dashboard';
  // Reject absolute URLs and protocol-relative URLs to prevent open redirect.
  const returnTo = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';

  useEffect(() => {
    if (!authLoading && session) navigate(returnTo);
  }, [session, authLoading, navigate, returnTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');
    setErrorMsg('');
    // Strip trailing slash so the path doesn't double-up when BASE_URL is a sub-path (e.g. /app/)
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const callbackUrl = `${window.location.origin}${base}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    });
    if (error) {
      setErrorMsg(error.message);
      setState('error');
    } else {
      setState('sent');
    }
  };

  // Don't flash the form at an already-signed-in user while the redirect fires
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
            We sent a magic link to{' '}
            <span className="font-medium text-foreground">{email}</span>.
            Click it to sign in — no password needed.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Don't see it? Check your spam folder.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-32 max-w-sm mx-auto space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email to receive a magic link.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={state === 'loading'}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
        {state === 'error' && (
          <p className="text-sm text-destructive">{errorMsg}</p>
        )}
        <button
          type="submit"
          disabled={state === 'loading'}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {state === 'loading' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
          {state === 'loading' ? 'Sending...' : 'Send magic link'}
        </button>
      </form>
    </div>
  );
}
