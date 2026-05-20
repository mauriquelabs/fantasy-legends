import { useState } from "react";
import { useUpcomingFixtures, useFixtureGames } from "@/hooks/useSorare";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock } from "lucide-react";

function GameRow({ game }: { game: { id: string; date: string; homeTeam: { name: string; pictureUrl: string } | null; awayTeam: { name: string; pictureUrl: string } | null; homeScore: number; awayScore: number } }) {
  const kickoff = new Date(game.date);
  const isPlayed = kickoff < new Date() && (game.homeScore > 0 || game.awayScore > 0);

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded bg-muted/10 hover:bg-muted/20 transition-colors text-sm" data-testid={`row-game-${game.id}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {game.homeTeam?.pictureUrl ? (
          <img src={game.homeTeam.pictureUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
        ) : (
          <div className="w-5 h-5 bg-muted/30 rounded-full shrink-0" />
        )}
        <span className="truncate font-medium">{game.homeTeam?.name ?? "TBD"}</span>
      </div>

      <div className="shrink-0 text-center min-w-[60px]">
        {isPlayed ? (
          <span className="font-mono font-bold text-primary">
            {game.homeScore} – {game.awayScore}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground font-mono">
            {kickoff.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className="truncate font-medium text-right">{game.awayTeam?.name ?? "TBD"}</span>
        {game.awayTeam?.pictureUrl ? (
          <img src={game.awayTeam.pictureUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
        ) : (
          <div className="w-5 h-5 bg-muted/30 rounded-full shrink-0" />
        )}
      </div>
    </div>
  );
}

function FixtureSection({ slug, gameWeek, startDate }: { slug: string; gameWeek: number; startDate: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: games, isLoading } = useFixtureGames(expanded ? slug : null);

  const start = new Date(startDate);
  const now = new Date();
  const isActive = start <= now;

  return (
    <Card className={`bg-card ${isActive ? "border-primary/30" : ""}`} data-testid={`card-fixture-${slug}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold">Game Week {gameWeek}</h3>
              {isActive && (
                <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded font-medium">LIVE</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{start.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
          </div>
          <button
            className="text-sm text-primary hover:underline font-medium"
            onClick={() => setExpanded((v) => !v)}
            data-testid={`button-expand-${slug}`}
          >
            {expanded ? "Hide fixtures" : "Show fixtures"}
          </button>
        </div>

        {expanded && (
          <div className="space-y-1.5">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)
            ) : games?.length === 0 ? (
              <div className="text-muted-foreground text-sm text-center py-4">No games found for this fixture.</div>
            ) : (
              <>
                {games?.slice(0, 18).map((g) => <GameRow key={g.id} game={g} />)}
                {(games?.length ?? 0) > 18 && (
                  <div className="text-center text-xs text-muted-foreground py-2 flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" />
                    +{(games?.length ?? 0) - 18} more games
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Fixtures() {
  const { data: fixtures, isLoading } = useUpcomingFixtures();

  return (
    <div className="space-y-6" data-testid="page-fixtures">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Fixtures</h2>
        <p className="text-muted-foreground mt-1">Upcoming SO5 game weeks. Click a fixture to see its matches.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-card">
              <CardContent className="p-6">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : fixtures?.length === 0 ? (
        <div className="text-muted-foreground p-8 text-center bg-card rounded-lg border border-border">
          No upcoming fixtures found.
        </div>
      ) : (
        <div className="space-y-4">
          {fixtures?.map((fixture) => (
            <FixtureSection
              key={fixture.slug}
              slug={fixture.slug}
              gameWeek={fixture.gameWeek}
              startDate={fixture.startDate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
