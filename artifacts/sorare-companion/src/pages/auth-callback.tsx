import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const [, navigate] = useLocation();
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; });
  // Supabase emits no error event for expired/used tokens — treat timeout as link failure
  const [linkFailed, setLinkFailed] = useState(false);

  const raw = new URLSearchParams(window.location.search).get('returnTo') ?? '/';
  const returnTo = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';

  useEffect(() => {
    const timeout = setTimeout(() => setLinkFailed(true), 30_000);

    // Token exchange is triggered by onAuthStateChange when the URL hash is processed
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        clearTimeout(timeout);
        navigateRef.current(returnTo);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  if (linkFailed) {
    return (
      <div className="flex flex-col items-center py-32 text-center space-y-4 max-w-md mx-auto">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Link expired or already used</h1>
          <p className="text-sm text-muted-foreground">
            Magic links are single-use and expire after 1 hour.
          </p>
        </div>
        <button
          onClick={() => navigateRef.current('/sign-in')}
          className="rounded-md bg-primary text-primary-foreground px-6 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Request a new link
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center py-32">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
}
