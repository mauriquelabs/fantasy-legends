import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type State = 'waiting' | 'linkFailed' | 'ready' | 'loading' | 'success' | 'error';

const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50";
const btnClass = "w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export default function AuthResetPassword() {
  const [, navigate] = useLocation();
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; });

  const [state, setState] = useState<State>('waiting');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Supabase processes the #access_token hash from the reset email link
    // and fires PASSWORD_RECOVERY before any other event.
    const timeout = setTimeout(() => setState('linkFailed'), 30_000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        clearTimeout(timeout);
        setState('ready');
      }
    });
    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');
    setErrorMsg('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMsg(error.message);
      setState('ready');
    } else {
      setState('success');
      setTimeout(() => navigateRef.current('/world-cup'), 1500);
    }
  };

  if (state === 'waiting') {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === 'linkFailed') {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-4 max-w-sm mx-auto">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Link expired</h1>
          <p className="text-sm text-muted-foreground">This password reset link has expired or already been used.</p>
        </div>
        <a href="/sign-in?mode=reset" className="text-sm text-muted-foreground underline underline-offset-2">
          Request a new one
        </a>
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
          <h1 className="text-xl font-semibold">Password updated</h1>
          <p className="text-sm text-muted-foreground">Redirecting you now…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-32 max-w-sm mx-auto space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Set new password</h1>
        <p className="text-sm text-muted-foreground">Choose a password for your account.</p>
      </div>
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (min 8 chars)"
          required
          minLength={8}
          disabled={state === 'loading'}
          className={inputClass}
        />
        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
        <button type="submit" disabled={state === 'loading'} className={btnClass}>
          {state === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
          {state === 'loading' ? 'Saving…' : 'Set password'}
        </button>
      </form>
    </div>
  );
}
