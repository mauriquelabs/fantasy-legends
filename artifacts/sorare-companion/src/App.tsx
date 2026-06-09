import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout";

// Pages
import Players from "@/pages/players";
import Fixtures from "@/pages/fixtures";
import WorldCup from "@/pages/world-cup";
import WorldCupHome from "@/pages/world-cup-home";
import SignIn from "@/pages/sign-in";
import AuthCallback from "@/pages/auth-callback";
import AuthResetPassword from "@/pages/auth-reset-password";
import AuthSetPassword from "@/pages/auth-set-password";
import JoinLeague from "@/pages/join-league";
import LeagueHome from "@/pages/league-home";
import GameweekDetail from "@/pages/gameweek-detail";
import GameDetail from "@/pages/game-detail";
import Leagues from "@/pages/leagues";
import CreateLeague from "@/pages/create-league";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <Redirect to="/leagues" />}</Route>
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/auth/reset-password" component={AuthResetPassword} />
      <Route path="/auth/set-password" component={AuthSetPassword} />
      <Route path="/join/:code" component={JoinLeague} />
      <Route>
        {() => (
          <AppLayout>
            <Switch>
              <Route path="/leagues" component={Leagues} />
              <Route path="/league/:code" component={LeagueHome} />
              <Route path="/league/:code/gameweeks/:slug" component={GameweekDetail} />
              <Route path="/league/:code/gameweeks/:slug/games/:gameId" component={GameDetail} />
              <Route path="/create-league" component={CreateLeague} />
              <Route path="/world-cup" component={WorldCupHome} />
              <Route path="/world-cup/squads/:slug" component={WorldCup} />
              <Route path="/world-cup/squads" component={WorldCup} />
              <Route path="/world-cup/fixtures" component={Fixtures} />
              <Route path="/world-cup/players" component={Players} />
              <Route path="/sign-in" component={SignIn} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
