import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, LogOut, ShoppingCart, LogIn } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  prices: Price[];
}

async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/stripe/products`);
  if (!res.ok) throw new Error("Failed to load products");
  const data = await res.json();
  return data.data ?? [];
}

async function startCheckout(priceId: string, token: string): Promise<string> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/stripe/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ priceId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Checkout failed");
  }
  return (await res.json()).url;
}

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

export default function Pricing() {
  const { session, user, loading: authLoading, signOut } = useAuth();
  const [, navigate] = useLocation();

  const { data: products = [], isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ["stripe-products"],
    queryFn: fetchProducts,
  });

  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleBuy = async (priceId: string) => {
    if (!session) {
      navigate(`/sign-in?returnTo=${encodeURIComponent('/pricing')}`);
      return;
    }
    setCheckoutError(null);
    setSelectedPriceId(priceId);
    setCheckoutLoading(true);
    try {
      const url = await startCheckout(priceId, session.access_token);
      window.location.href = url;
    } catch (err: any) {
      setCheckoutError(err.message ?? "Something went wrong");
    } finally {
      setCheckoutLoading(false);
      setSelectedPriceId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-10">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Upgrade Your Scouting</h1>
        <p className="text-muted-foreground text-base">
          One-time purchases — no subscription required.
        </p>
      </div>

      {!authLoading && (
        <div className="flex items-center justify-center gap-3">
          {session ? (
            <>
              <p className="text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{user?.email}</span>
              </p>
              <button
                onClick={signOut}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="w-3 h-3" />
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/sign-in")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign in to purchase
            </button>
          )}
        </div>
      )}

      {productsLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {productsError && (
        <div className="text-center text-muted-foreground py-20">
          <p>Could not load products. Make sure the API server is running.</p>
        </div>
      )}

      {!productsLoading && !productsError && products.length === 0 && (
        <div className="text-center text-muted-foreground py-20">
          <p>No products available yet.</p>
          <p className="text-xs mt-1 opacity-60">Run the seed-products script to add products.</p>
        </div>
      )}

      {products.length > 0 && (
        <>
          {checkoutError && (
            <p className="text-sm text-red-400 text-center">{checkoutError}</p>
          )}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const price = product.prices[0];
              const isThisLoading = checkoutLoading && selectedPriceId === price?.id;
              return (
                <div
                  key={product.id}
                  className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4 hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-1 flex-1">
                    <h2 className="font-semibold text-base">{product.name}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {product.description}
                    </p>
                  </div>

                  {price && (
                    <div className="space-y-3">
                      <p className="text-2xl font-bold">
                        {formatPrice(price.unit_amount, price.currency)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          one-time
                        </span>
                      </p>
                      <button
                        onClick={() => handleBuy(price.id)}
                        disabled={checkoutLoading}
                        className="w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isThisLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ShoppingCart className="w-4 h-4" />
                        )}
                        {isThisLoading ? "Redirecting..." : session ? "Buy Now" : "Sign in to buy"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="border border-border rounded-lg p-5 bg-card/50 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          What's included
        </p>
        <ul className="space-y-2">
          {[
            "Secure checkout powered by Stripe",
            "Instant delivery after payment",
            "No subscription — pay once",
            "Receipt sent to your email",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4 text-green-500 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
