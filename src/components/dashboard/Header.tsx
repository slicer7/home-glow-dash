import { Link } from "@tanstack/react-router";
import { Boxes } from "lucide-react";

export function Header({ connected }: { connected: boolean }) {
  const linkClass =
    "rounded-full px-3 py-1 text-muted-foreground transition-colors hover:text-foreground whitespace-nowrap";
  const activeClass =
    "rounded-full px-3 py-1 bg-primary/15 text-primary whitespace-nowrap";

  return (
    <header className="flex flex-col gap-2 border-b border-border bg-card/40 px-3 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-center justify-between gap-3 sm:justify-start">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              Smart Home
            </h1>
            <p className="hidden text-xs text-muted-foreground sm:block">
              ESP32 control panel
            </p>
          </div>
        </div>

        {/* Status dot — visible on mobile inline with logo, on desktop it moves right */}
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-xs sm:hidden">
          <span
            className="relative flex h-2.5 w-2.5"
            aria-label={connected ? "Connected" : "Disconnected"}
          >
            {connected && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                connected ? "bg-primary" : "bg-destructive"
              }`}
            />
          </span>
        </div>
      </div>

      <nav className="-mx-1 flex items-center gap-1 overflow-x-auto rounded-full border border-border bg-secondary/30 p-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link to="/" className={linkClass} activeProps={{ className: activeClass }} activeOptions={{ exact: true }}>
          Room
        </Link>
        <Link to="/remotes" className={linkClass} activeProps={{ className: activeClass }}>
          Remotes
        </Link>
        <Link to="/devices" className={linkClass} activeProps={{ className: activeClass }}>
          Devices
        </Link>
        <Link to="/alarms" className={linkClass} activeProps={{ className: activeClass }}>
          Alarms
        </Link>
        <Link to="/events" className={linkClass} activeProps={{ className: activeClass }}>
          Activity
        </Link>
      </nav>

      <div className="hidden items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs sm:flex">
        <span
          className="relative flex h-2.5 w-2.5"
          aria-label={connected ? "Connected" : "Disconnected"}
        >
          {connected && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          )}
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
              connected ? "bg-primary" : "bg-destructive"
            }`}
          />
        </span>
        <span className="text-muted-foreground">
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>
    </header>
  );
}
