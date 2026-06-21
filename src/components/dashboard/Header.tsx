import { Link } from "@tanstack/react-router";
import { Boxes } from "lucide-react";

export function Header({ connected }: { connected: boolean }) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-card/40 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Boxes className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Smart Home</h1>
          <p className="text-xs text-muted-foreground">ESP32 control panel</p>
        </div>
      </div>

      <nav className="flex items-center gap-1 rounded-full border border-border bg-secondary/30 p-1 text-sm">
        <Link
          to="/"
          className="rounded-full px-3 py-1 text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "rounded-full px-3 py-1 bg-primary/15 text-primary" }}
          activeOptions={{ exact: true }}
        >
          Room
        </Link>
        <Link
          to="/remotes"
          className="rounded-full px-3 py-1 text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "rounded-full px-3 py-1 bg-primary/15 text-primary" }}
        >
          Remotes
        </Link>
        <Link
          to="/alarms"
          className="rounded-full px-3 py-1 text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "rounded-full px-3 py-1 bg-primary/15 text-primary" }}
        >
          Alarms
        </Link>
        <Link
          to="/events"
          className="rounded-full px-3 py-1 text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "rounded-full px-3 py-1 bg-primary/15 text-primary" }}
        >
          Activity
        </Link>
      </nav>

      <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs">
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
        <span className="hidden text-muted-foreground sm:inline">
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>
    </header>
  );
}
