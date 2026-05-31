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

const queryClient = new QueryClient();

function WorldCupHome() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center space-y-3">
      <h2 className="text-3xl font-bold tracking-tight">World Cup 2026</h2>
      <p className="text-muted-foreground">Home page coming soon.</p>
    </div>
  );
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/">{() => <Redirect to="/world-cup" />}</Route>
        <Route path="/world-cup" component={WorldCupHome} />
        <Route path="/world-cup/squads/:slug" component={WorldCup} />
        <Route path="/world-cup/squads" component={WorldCup} />
        <Route path="/world-cup/fixtures" component={Fixtures} />
        <Route path="/world-cup/players" component={Players} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
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
