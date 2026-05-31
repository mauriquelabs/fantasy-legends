import { Link, useLocation } from "wouter";
import { Search, Trophy, Users } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/world-cup/squads", label: "Squads", icon: Users },
    { href: "/world-cup/fixtures", label: "Fixtures", icon: Trophy },
    { href: "/world-cup/players", label: "Players", icon: Search },
  ];

  function isActive(item: (typeof navItems)[number]) {
    return location === item.href || location.startsWith(item.href + "/");
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground dark">
      {/* Sidebar — desktop only */}
      <aside className="w-64 border-r border-border bg-card flex-col hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/world-cup">
            <h1 className="text-xl font-bold tracking-tight cursor-pointer hover:text-primary transition-colors">
              World Cup 2026
            </h1>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors cursor-pointer ${
                  isActive(item)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium text-sm">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen md:h-screen md:overflow-hidden">
        {/* Mobile header */}
        <header className="h-14 flex items-center px-5 border-b border-border bg-background md:hidden shrink-0">
          <Link href="/world-cup">
            <h1 className="text-lg font-bold tracking-tight cursor-pointer hover:text-primary transition-colors">
              World Cup 2026
            </h1>
          </Link>
        </header>

        {/* Page content — padded bottom on mobile to clear the tab bar */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </div>

        {/* Bottom tab bar — mobile only */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border">
          <div className="flex">
            {navItems.map((item) => {
              const active = isActive(item);
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={`flex flex-col items-center justify-center gap-1 py-3 flex-1 transition-colors ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
                    <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
                    {active && (
                      <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
      </main>
    </div>
  );
}
