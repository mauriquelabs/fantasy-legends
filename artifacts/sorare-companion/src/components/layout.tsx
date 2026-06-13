import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Search, Trophy, Users, Calendar, Home, LogIn, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyLeagues } from "@/hooks/useApi";
import { FLAGS } from "@/lib/flags";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { session, user, loading: authLoading, signOut } = useAuth();
  const { data: leagues } = useMyLeagues(session);
  const [menuOpen, setMenuOpen] = useState(false);

  const firstLeague = leagues?.[0] ?? null;

  const handleSignOut = () => signOut().then(() => navigate('/world-cup'));

  useEffect(() => { setMenuOpen(false); }, [location]);

  const homeHref = firstLeague ? `/league/${firstLeague.code}` : "/world-cup";

  const navItems = [
    { href: homeHref, label: "Home", icon: Home, exact: true },
    ...(FLAGS.isAdmin ? [{ href: "/leagues", label: "Leagues", icon: Trophy, exact: false }] : []),
    ...(!firstLeague ? [{ href: "/world-cup/fixtures", label: "Fixtures", icon: Calendar, exact: false }] : []),
    { href: "/world-cup/players", label: "Players", icon: Search, exact: false },
    ...(FLAGS.isAdmin ? [{ href: "/world-cup/squads", label: "Squads", icon: Users, exact: false }] : []),
  ];

  function isActive(item: (typeof navItems)[number]) {
    if (item.label === "Home") {
      return location === item.href
        || location === "/"
        || location === "/world-cup"
        || (!!firstLeague && location.startsWith(`/league/${firstLeague.code}`));
    }
    if (item.exact) return location === item.href;
    return location === item.href || location.startsWith(item.href + "/");
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col">
      <header className="h-14 shrink-0 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="h-full max-w-screen-xl mx-auto px-4 flex items-center gap-4">
          <Link href={homeHref}>
            <span className="text-base font-bold tracking-tight cursor-pointer hover:text-primary transition-colors whitespace-nowrap">
              World Cup 2026
            </span>
          </Link>

          {/* Desktop nav */}
          {session && (
            <nav className="hidden md:flex items-center gap-1 flex-1">
              {navItems.map((item) => {
                const active = isActive(item);
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      }`}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Desktop auth */}
          <div className="ml-auto hidden md:flex items-center gap-3 shrink-0">
            {!authLoading && (
              session ? (
                <>
                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">{user?.email}</span>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </>
              ) : (
                <Link href="/sign-in">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    <LogIn className="w-4 h-4" />
                    Sign in
                  </div>
                </Link>
              )
            )}
          </div>

          {/* Mobile burger */}
          <button
            className="md:hidden ml-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40 top-14">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-0 right-0 w-64 h-full bg-card border-l border-border flex flex-col">
            {session && (
              <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => {
                  const active = isActive(item);
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                          active
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        }`}
                      >
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            )}

            <div className="p-4 border-t border-border">
              {!authLoading && (
                session ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                ) : (
                  <Link href="/sign-in">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      <LogIn className="w-4 h-4" />
                      Sign in
                    </div>
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-screen-xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
