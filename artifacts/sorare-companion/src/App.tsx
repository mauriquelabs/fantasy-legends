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
import Pricing from "@/pages/pricing";
import CheckoutSuccess from "@/pages/checkout-success";
import AuthResetPassword from "@/pages/auth-reset-password";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <Redirect to="/world-cup" />}</Route>
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/auth/reset-password" component={AuthResetPassword} />
      <Route>
        {() => (
          <AppLayout>
            <Switch>
              <Route path="/world-cup" component={WorldCupHome} />
              <Route path="/world-cup/squads/:slug" component={WorldCup} />
              <Route path="/world-cup/squads" component={WorldCup} />
              <Route path="/world-cup/fixtures" component={Fixtures} />
              <Route path="/world-cup/players" component={Players} />
              <Route path="/sign-in" component={SignIn} />
              <Route path="/pricing" component={Pricing} />
              <Route path="/checkout/success" component={CheckoutSuccess} />
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
