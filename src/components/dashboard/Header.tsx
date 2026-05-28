import { Activity } from "lucide-react";

export function Header({ connected }: { connected: boolean }) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-card/40 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Smart Home</h1>
          <p className="text-xs text-muted-foreground">ESP32 control panel</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs">
        <span
          className={`relative flex h-2.5 w-2.5 ${connected ? "" : ""}`}
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
          {connected ? "Realtime connected" : "Disconnected"}
        </span>
      </div>
    </header>
  );
}
