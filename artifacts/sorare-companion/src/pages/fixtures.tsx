import { useState } from "react";
import {
  useUpcomingFixtures,
  useFixtureGames,
  useClubStrength,
} from "@/hooks/useSorare";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ChevronDown, ChevronUp } from "lucide-react";
import type { Game } from "@/hooks/useSorare";

/** Convert average club score to a difficulty tier */
function difficultyTier(score: number | undefined): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  if (score === undefined)
    return { label: "?", bg: "bg-muted/30", text: "text-muted-foreground", border: "border-border/30" };
  if (score >= 55)
    return { label: "Very Hard", bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30" };
  if (score >= 50)
    return { label: "Hard", bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30" };
  if (score >= 45)
    return { label: "Medium", bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/30" };
  if (score >= 38)
    return { label: "Easy", bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/30" };
  return { label: "Weak", bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" };
}

function DifficultyBadge({ clubName, strength }: { clubName: string; strength: Record<string, number> }) {
  const score = strength[clubName];
  const tier = difficultyTier(score);
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${tier.bg} ${tier.text} ${tier.border} uppercase tracking-wide`}
      title={score !== undefined ? `Avg score: ${score.toFixed(1)}` : "No data"}
    >
      {tier.label}
    </span>
  );
}

function GameRow({ game, strength }: { game: Game; strength: Record<string, number> }) {
  const kickoff = new Date(game.date);
  const isPlayed = kickoff < new Date();
  const hasScore = game.homeScore > 0 || game.awayScore > 0;

  return (
    <div
      className="flex items-center gap-2 py-2.5 px-3 rounded bg-muted/10 hover:bg-muted/20 transition-colors text-sm"
      data-testid={`row-game-${game.id}`}
    >
      {/* Home team */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          {game.homeTeam?.pictureUrl ? (
            <img src={game.homeTeam.pictureUrl} alt="" className="w-4 h-4 object-contain shrink-0" />
          ) : (
            <div className="w-4 h-4 bg-muted/40 rounded-full shrink-0" />
          )}
          <span className="font-medium truncate text-xs">{game.homeTeam?.name ?? "TBD"}</span>
        </div>
        {game.awayTeam && (
          <DifficultyBadge clubName={game.awayTeam.name} strength={strength} />
        )}
      </div>

      {/* Score / Kickoff */}
      <div className="shrink-0 text-center min-w-[54px]">
        {isPlayed && hasScore ? (
          <span className="font-mono font-bold text-primary text-sm">
            {game.homeScore} – {game.awayScore}
          </span>
        ) : (
          <div className="text-center">
            <div className="font-mono text-xs text-primary">
              {kickoff.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {kickoff.toLocaleDateString([], { day: "numeric", month: "short" })}
            </div>
          </div>
        )}
      </div>

      {/* Away team */}
      <div className="flex-1 min-w-0 text-right">
        <div className="flex items-center gap-1.5 justify-end mb-1">
          <span className="font-medium truncate text-xs">{game.awayTeam?.name ?? "TBD"}</span>
          {game.awayTeam?.pictureUrl ? (
            <img src={game.awayTeam.pictureUrl} alt="" className="w-4 h-4 object-contain shrink-0" />
          ) : (
            <div className="w-4 h-4 bg-muted/40 rounded-full shrink-0" />
          )}
        </div>
        {game.homeTeam && (
          <div className="flex justify-end">
            <DifficultyBadge clubName={game.homeTeam.name} strength={strength} />
          </div>
        )}
      </div>
    </div>
  );
}

function FixtureSection({
  slug,
  gameWeek,
  startDate,
  strength,
  defaultExpanded,
}: {
  slug: string;
  gameWeek: number;
  startDate: string;
  strength: Record<string, number>;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const { data: games, isLoading } = useFixtureGames(expanded ? slug : null);

  const start = new Date(startDate);
  const now = new Date();
  const isActive = start <= now;

  return (
    <Card
      className={`bg-card ${isActive ? "border-primary/30" : ""}`}
      data-testid={`card-fixture-${slug}`}
    >
      <CardContent className="p-5">
        <button
          className="w-full flex items-center justify-between mb-0 gap-3"
          onClick={() => setExpanded((v) => !v)}
          data-testid={`button-expand-${slug}`}
        >
          <div className="flex items-center gap-3 text-left">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Game Week {gameWeek}</h3>
                {isActive && (
                  <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    LIVE
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Calendar className="w-3 h-3" />
                <span>
                  {start.toLocaleDateString([], {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!expanded && games && (
              <span className="text-xs text-muted-foreground">{games.length} matches</span>
            )}
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="mt-4 space-y-1.5">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded" />
              ))
            ) : games?.length === 0 ? (
              <div className="text-muted-foreground text-sm text-center py-4">
                No games found for this fixture.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 text-[10px] uppercase tracking-wide text-muted-foreground px-3 pb-1">
                  <span>Home</span>
                  <span className="text-center">Score/KO</span>
                  <span className="text-right">Away</span>
                </div>
                {games?.map((g) => (
                  <GameRow key={g.id} game={g} strength={strength} />
                ))}
                <p className="text-[10px] text-muted-foreground text-center pt-1">
                  Difficulty badges show how strong the opponent is (based on popular Sorare player scores).
                </p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Fixtures() {
  const { data: fixtures, isLoading: loadingFixtures } = useUpcomingFixtures();
  const { data: strength = {}, isLoading: loadingStrength } = useClubStrength();

  const isLoading = loadingFixtures || loadingStrength;

  return (
    <div className="space-y-5" data-testid="page-fixtures">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Fixture Difficulty</h2>
        <p className="text-muted-foreground mt-1">
          Upcoming SO5 game weeks with opponent difficulty ratings — based on Sorare player average scores.
        </p>
      </div>

      {/* Difficulty key */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { label: "Very Hard", bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30", hint: "≥55 avg" },
          { label: "Hard", bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30", hint: "≥50" },
          { label: "Medium", bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/30", hint: "≥45" },
          { label: "Easy", bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/30", hint: "≥38" },
          { label: "Weak", bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30", hint: "<38" },
        ].map((d) => (
          <span
            key={d.label}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-bold uppercase tracking-wide ${d.bg} ${d.text} ${d.border}`}
          >
            {d.label} <span className="font-normal opacity-70">{d.hint}</span>
          </span>
        ))}
        {loadingStrength && (
          <span className="text-muted-foreground italic">Loading strength data…</span>
        )}
      </div>

      {isLoading && !fixtures ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-card">
              <CardContent className="p-5">
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
        <div className="space-y-3">
          {fixtures?.map((fixture, idx) => (
            <FixtureSection
              key={fixture.slug}
              slug={fixture.slug}
              gameWeek={fixture.gameWeek}
              startDate={fixture.startDate}
              strength={strength}
              defaultExpanded={idx === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
