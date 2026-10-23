import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Play from "@/pages/Play";
import Explore from "@/pages/Explore";
import About from "@/pages/About";

function Header() {
  const [location] = useLocation();
  const navs = [
    { href: "/", label: "情境" },
    { href: "/explore", label: "探索地圖" },
    { href: "/about", label: "設計說明" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" data-testid="link-home">
          <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
            <path
              d="M6 22 L14 10 L18 16 L26 22"
              stroke="hsl(33 62% 64%)"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="14" cy="10" r="2.2" fill="hsl(33 62% 64%)" />
          </svg>
          <span className="font-serif text-base font-semibold tracking-wide">
            岔路
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {navs.map((n) => {
            const active =
              n.href === "/" ? location === "/" : location.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors hover:text-foreground ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid={`nav-${n.label}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function AppRouter() {
  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-24">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/play/:id" component={(p: { params: { id: string } }) => <Play key={p.params.id} {...p} />} />
          <Route path="/explore" component={Explore} />
          <Route path="/explore/:id" component={Explore} />
          <Route path="/about" component={About} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
