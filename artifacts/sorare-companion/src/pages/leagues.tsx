import { useLocation } from "wouter";
import { Loader2, Trophy, Users, PlusCircle, Link2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyLeagues, type LeagueSummary } from "@/hooks/useApi";
import { FLAGS } from "@/lib/flags";

function LeagueCard({ league }: { league: LeagueSummary }) {
  const [, navigate] = useLocation();
  const draftLabel = league.draftAt
    ? new Date(league.draftAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : "Draft date TBD";

  return (
    <button
      onClick={() => navigate(`/league/${league.code}`)}
      className="w-full text-left rounded-2xl border border-border bg-card/60 p-5 hover:border-primary/40 hover:bg-card transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/20 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-base leading-tight">{league.name}</h2>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{league.code}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {league.memberCount} {league.memberCount === 1 ? "member" : "members"}
        </span>
        <span>{draftLabel}</span>
      </div>
    </button>
  );
}

export default function Leagues() {
  const [, navigate] = useLocation();
  const { session, loading: authLoading } = useAuth();
  const { data: leagues, isLoading } = useMyLeagues(session);

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center py-32 text-center space-y-4 max-w-sm mx-auto">
        <Trophy className="w-10 h-10 text-muted-foreground/40" />
        <h1 className="text-lg font-semibold">Sign in to see your leagues</h1>
        <button
          onClick={() => navigate("/sign-in")}
          className="rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Leagues</h1>
          {leagues && leagues.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {leagues.length} {leagues.length === 1 ? "league" : "leagues"}
            </p>
          )}
        </div>
        {FLAGS.createLeague && (
          <button
            onClick={() => navigate("/create-league")}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New league
          </button>
        )}
      </div>

      {leagues && leagues.length > 0 ? (
        <div className="space-y-3">
          {leagues.map(league => (
            <LeagueCard key={league.code} league={league} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-20 text-center space-y-6 max-w-sm mx-auto">
          <div className="p-5 rounded-full bg-muted/20">
            <Trophy className="w-10 h-10 text-muted-foreground/40" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold">No leagues yet</h2>
            <p className="text-sm text-muted-foreground">
              Create a league or ask your friends to send you an invite link.
            </p>
          </div>
          <div className="flex flex-col w-full gap-3">
            {FLAGS.createLeague && (
              <button
                onClick={() => navigate("/create-league")}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                Create a league
              </button>
            )}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Link2 className="w-4 h-4" />
              <span>Or join via an invite link from your group</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
