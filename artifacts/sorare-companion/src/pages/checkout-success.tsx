import { useState, useEffect, useRef } from 'react';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';

export default function CheckoutSuccess() {
  const sessionId = new URLSearchParams(window.location.search).get('session_id');
  const { session, loading: authLoading } = useAuth();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [, navigate] = useLocation();
  const provisionedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      navigate('/sign-in');
      return;
    }
    if (!sessionId) {
      setState('error');
      return;
    }
    if (provisionedRef.current) return;
    provisionedRef.current = true;

    (async () => {
      try {
        const base = import.meta.env.BASE_URL.replace(/\/$/, '');
        const res = await fetch(`${base}/api/stripe/provision`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) throw new Error('Provision failed');
        setState('success');
      } catch {
        setState('error');
      }
    })();
  }, [sessionId, session, authLoading, navigate]);

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
        <CheckCircle className="w-8 h-8 text-green-500" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Payment confirmed!</h1>
        <p className="text-muted-foreground">
          You're all set. Your purchase has been recorded.
        </p>
      </div>
      <button
        onClick={() => navigate('/world-cup')}
        className="rounded-md bg-primary text-primary-foreground px-6 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Continue
      </button>
    </div>
  );
}
