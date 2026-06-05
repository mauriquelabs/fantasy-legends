import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Trophy, Users, ShoppingBag } from 'lucide-react';

export default function Dashboard() {
  const { session, user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && !session) {
      navigate('/sign-in?returnTo=/dashboard');
    }
  }, [session, authLoading, navigate]);

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/stripe/orders`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to load orders');
      return (await res.json()).data ?? [];
    },
    enabled: !!session,
  });

  if (authLoading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {([
          { href: '/world-cup', label: 'World Cup Hub', Icon: Trophy },
          { href: '/world-cup/players', label: 'Players', Icon: Users },
          { href: '/pricing', label: 'Store', Icon: ShoppingBag },
        ] as const).map(({ href, label, Icon }) => (
          <Link key={href} href={href}>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors cursor-pointer">
              <Icon className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">{label}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your purchases</h2>
        {ordersLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/50 p-6 text-center space-y-1">
            <p className="text-sm text-muted-foreground">No purchases yet.</p>
            <Link href="/pricing">
              <span className="text-sm text-primary hover:underline cursor-pointer inline-block">Browse the store →</span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card overflow-hidden">
            {orders.map((order: any) => (
              <div key={order.id} className="flex items-center justify-between px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{order.product_name ?? 'Purchase'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-sm font-medium">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: order.currency ?? 'usd',
                  }).format(order.amount / 100)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
