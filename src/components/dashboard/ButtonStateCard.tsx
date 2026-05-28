import { useEffect, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Power } from "lucide-react";

export function ButtonStateCard({ lastPressedAt }: { lastPressedAt: Date | null }) {
  const [flash, setFlash] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!lastPressedAt) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, [lastPressedAt]);

  // Re-render every second so "X seconds ago" updates
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold">P4 Hub Button</h2>
          <p className="text-xs text-muted-foreground">device_id: p4_hub</p>
        </div>
        <span className="rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Live
        </span>
      </div>

      <div className="mt-8 flex flex-col items-center justify-center gap-4 py-4">
        <div
          className={`flex h-32 w-32 items-center justify-center rounded-full border-2 transition-all duration-300 ${
            flash
              ? "scale-110 border-primary bg-primary/25 text-primary"
              : "border-border bg-secondary/40 text-muted-foreground"
          }`}
          style={flash ? { boxShadow: "var(--emerald-glow)" } : undefined}
        >
          <Power className="h-12 w-12" strokeWidth={1.5} />
        </div>
        <p className="text-sm text-muted-foreground">
          {lastPressedAt ? (
            <>
              Last pressed:{" "}
              <span className="font-medium text-foreground">
                {formatDistanceToNowStrict(lastPressedAt, { addSuffix: true })}
              </span>
            </>
          ) : (
            "Never pressed"
          )}
        </p>
      </div>
    </div>
  );
}
