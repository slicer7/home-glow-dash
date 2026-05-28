import { useEffect, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import type { DeviceEvent } from "@/lib/supabase";

export function EventFeed({ events }: { events: DeviceEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events]);

  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Live Event Feed</h2>
          <p className="text-xs text-muted-foreground">
            Realtime device_events · last {events.length}
          </p>
        </div>
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Waiting for events from your devices…
          </div>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => {
              const isHubButton =
                e.device_id === "p4_hub" && e.event_type === "button_press";
              return (
                <li
                  key={e.id}
                  className={`rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    isHubButton
                      ? "border-primary/40 bg-primary/10"
                      : "border-border/60 bg-secondary/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                          isHubButton
                            ? "bg-primary/25 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {e.event_type}
                      </span>
                      <span className="truncate text-xs font-medium text-foreground">
                        {e.device_id}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(e.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  {e.payload && Object.keys(e.payload).length > 0 && (
                    <pre className="mt-1.5 overflow-x-auto rounded bg-background/40 px-2 py-1 text-[11px] text-muted-foreground">
                      {JSON.stringify(e.payload)}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
