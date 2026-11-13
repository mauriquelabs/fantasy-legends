import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Search, Trophy, Users, Calendar, Home, LogIn, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_COMPETITION_CODE,
  useCompetitions,
} from "@/hooks/useCompetition";

function useActiveCompetitionCode(): string {
  const [location] = useLocation();
  const match = location.match(/^\/c\/([^/]+)/);
  return match?.[1] ?? DEFAULT_COMPETITION_CODE;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { session, user, loading: authLoading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const competitionCode = useActiveCompetitionCode();
  const { data: competitionsData } = useCompetitions();

  const competitionLabel = useMemo(() => {
    const list = competitionsData?.competitions ?? [];
    const current = list.find((c) => c.code === competitionCode);
    return current?.displayName ?? current?.name ?? "Fantasy Legends";
  }, [competitionsData, competitionCode]);

  const base = `/c/${competitionCode}`;
  const handleSignOut = () => signOut().then(() => navigate(base));

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  const navItems = [
    { href: base, label: "Home", icon: Home, exact: true },
    { href: "/leagues", label: "Leagues", icon: Trophy, exact: false },
    { href: `${base}/fixtures`, label: "Fixtures", icon: Calendar, exact: false },
    { href: `${base}/players`, label: "Players", icon: Search, exact: false },
    { href: `${base}/squads`, label: "Squads", icon: Users, exact: false },
  ];

  function isActive(item: (typeof navItems)[number]) {
    if (item.exact) {
      return location === item.href || location === `${item.href}/`;
    }
    return location === item.href || location.startsWith(item.href + "/");
  }

  const otherCompetitions = (competitionsData?.competitions ?? []).filter(
    (c) => c.code !== competitionCode,
  );

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col">
      <header className="h-14 shrink-0 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="h-full max-w-screen-xl mx-auto px-4 flex items-center gap-4">
          <Link href={base}>
            <span className="text-base font-bold tracking-tight cursor-pointer hover:text-primary transition-colors whitespace-nowrap">
              {competitionLabel}
            </span>
          </Link>

          {otherCompetitions.length > 0 && (
            <select
              aria-label="Switch competition"
              className="hidden sm:block text-xs bg-background border border-border rounded-md px-2 py-1 text-muted-foreground"
              value={competitionCode}
              onChange={(e) => navigate(`/c/${e.target.value}`)}
            >
              <option value={competitionCode}>{competitionLabel}</option>
              {otherCompetitions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.displayName ?? c.name}
                </option>
              ))}
            </select>
          )}

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

          <div className="ml-auto hidden md:flex items-center gap-3 shrink-0">
            {!authLoading &&
              (session ? (
                <>
                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                    {user?.email}
                  </span>
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
              ))}
          </div>

          <button
            className="md:hidden ml-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

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
              {!authLoading &&
                (session ? (
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
                ))}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-screen-xl mx-auto p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
