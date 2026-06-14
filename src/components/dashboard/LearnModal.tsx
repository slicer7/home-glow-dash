import { useEffect, useState } from "react";
import { supabase, type DeviceEvent } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Radio, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const LEARN_TIMEOUT_MS = 15_000;

type Status = "listening" | "success" | "timeout";

export function LearnModal({
  open,
  slot,
  label,
  onOpenChange,
  onLearned,
}: {
  open: boolean;
  slot: number | null;
  label: string;
  onOpenChange: (open: boolean) => void;
  onLearned: () => void;
}) {
  const [status, setStatus] = useState<Status>("listening");
  const [elapsed, setElapsed] = useState(0);
  const [symbols, setSymbols] = useState<number | null>(null);

  const startLearn = async (s: number) => {
    setStatus("listening");
    setElapsed(0);
    setSymbols(null);
    const { error } = await supabase.from("commands").insert({
      target_device: "p4_hub",
      command: "rf_bind",
      params: { slot: s },
    });
    if (error) {
      toast.error("Failed to send learn command", { description: error.message });
      onOpenChange(false);
    }
  };

  // Kick off learn whenever the modal opens for a new slot
  useEffect(() => {
    if (open && slot !== null) startLearn(slot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slot]);

  // Timer + realtime subscription while listening
  useEffect(() => {
    if (!open || slot === null || status !== "listening") return;

    const startedAt = Date.now();
    const tick = setInterval(() => {
      const e = Date.now() - startedAt;
      setElapsed(e);
      if (e >= LEARN_TIMEOUT_MS) {
        setStatus("timeout");
      }
    }, 150);

    const channel = supabase
      .channel(`rf_learn_${slot}_${startedAt}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "device_events" },
        async (payload) => {
          const evt = payload.new as DeviceEvent;
          const p = (evt.payload ?? {}) as { slot?: number; symbols?: number };
          if (evt.event_type === "rf_bound" && p.slot === slot) {
            setSymbols(typeof p.symbols === "number" ? p.symbols : null);
            await supabase.from("rf_signals").update({ learned: true }).eq("slot", slot);
            setStatus("success");
            toast.success(
              `Learned${typeof p.symbols === "number" ? ` (${p.symbols} symbols)` : ""}`,
              { description: label },
            );
            onLearned();
            setTimeout(() => onOpenChange(false), 900);
          }
        },
      )
      .subscribe();

    return () => {
      clearInterval(tick);
      supabase.removeChannel(channel);
    };
  }, [open, slot, status, label, onLearned, onOpenChange]);

  const pct = Math.min(100, (elapsed / LEARN_TIMEOUT_MS) * 100);
  const secondsLeft = Math.max(0, Math.ceil((LEARN_TIMEOUT_MS - elapsed) / 1000));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Learn “{label}”</DialogTitle>
          <DialogDescription>
            Slot {slot ?? "—"} · binding a new RF remote button
          </DialogDescription>
        </DialogHeader>

        {status === "listening" && (
          <div className="flex flex-col items-center gap-5 py-4">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary/60 bg-primary/10 text-primary"
              style={{ boxShadow: "var(--emerald-glow)" }}
            >
              <Radio className="h-10 w-10 animate-pulse" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Point your remote at the hub and press the button…
            </p>
            <div className="w-full space-y-1.5">
              <Progress value={pct} />
              <p className="text-center text-xs text-muted-foreground">
                {secondsLeft}s remaining
              </p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <p className="text-sm font-medium">
              Learned!{symbols !== null && ` (${symbols} symbols)`}
            </p>
          </div>
        )}

        {status === "timeout" && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Didn’t catch a signal — hold the remote closer and try again.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => slot !== null && startLearn(slot)}>Retry</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
