import { useState, useEffect } from 'react';
import { Mail, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function CheckoutSuccess() {
  const sessionId = new URLSearchParams(window.location.search).get('session_id');
  const [state, setState] = useState<'loading' | 'sent' | 'error'>('loading');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setState('error');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/stripe/provision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) throw new Error('Provision failed');
        const { email: customerEmail } = await res.json();
        setEmail(customerEmail);

        const base = import.meta.env.BASE_URL.replace(/\/$/, '');
        await supabase.auth.signInWithOtp({
          email: customerEmail,
          options: { emailRedirectTo: `${window.location.origin}${base}/auth/callback` },
        });

        setState('sent');
      } catch {
        setState('error');
      }
    })();
  }, [sessionId]);

  if (state === 'loading') {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center py-32 text-center space-y-4 max-w-md mx-auto">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            Your payment was processed. Contact support if you don't receive access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-32 text-center space-y-6 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
        <Mail className="w-8 h-8 text-green-500" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Payment confirmed!</h1>
        <p className="text-muted-foreground">
          We've sent a magic link to{' '}
          <span className="font-medium text-foreground">{email}</span>.
          Click it to get instant access — no password needed.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">Don't see it? Check your spam folder.</p>
    </div>
  );
}
