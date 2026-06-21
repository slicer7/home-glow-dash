import { useEffect, useRef, useState } from "react";
import { supabase, type IrSignal, type IrDevice, type IrIcon } from "@/lib/supabase";
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

// The P4 polls every ~2s and each IR capture window is up to 15s; give plenty
// of slack so a queued/late capture still resolves.
const LEARN_TIMEOUT_MS = 30_000;

type Status = "listening" | "success" | "timeout";

export function IrLearnModal({
  open,
  device,
  label,
  icon,
  onOpenChange,
  onLearned,
}: {
  open: boolean;
  device: IrDevice | null;
  label: string;
  icon: IrIcon;
  onOpenChange: (open: boolean) => void;
  onLearned: () => void;
}) {
  const [status, setStatus] = useState<Status>("listening");
  const [elapsed, setElapsed] = useState(0);

  // Keep latest props in refs so the realtime effect can depend only on
  // [open, device, label] and not churn on every parent re-render.
  const iconRef = useRef(icon);
  const onLearnedRef = useRef(onLearned);
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    iconRef.current = icon;
    onLearnedRef.current = onLearned;
    onOpenChangeRef.current = onOpenChange;
  });

  const startLearn = async (dev: IrDevice, lbl: string) => {
    setStatus("listening");
    setElapsed(0);
    const { error } = await supabase.from("commands").insert({
      target_device: "p4_hub",
      command: "ir_learn",
      params: { device: dev, label: lbl },
    });
    if (error) {
      toast.error("Failed to send learn command", { description: error.message });
      onOpenChange(false);
    }
  };

  // Kick off learning whenever the modal opens for a new label/device.
  useEffect(() => {
    if (open && device) startLearn(device, label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, device, label]);

  // Realtime: a fresh ir_signals row (matching our device + label) means the P4
  // captured the code. Apply the chosen icon, then finish.
  useEffect(() => {
    if (!open || !device) return;

    const channel = supabase
      .channel(`ir_learn_${device}_${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ir_signals" },
        async (payload) => {
          const row = payload.new as IrSignal;
          if (row.device !== device || row.label !== label) return;
          // The firmware inserts with a default icon; set the one the user picked.
          if (iconRef.current && row.icon !== iconRef.current) {
            await supabase
              .from("ir_signals")
              .update({ icon: iconRef.current })
              .eq("id", row.id);
          }
          // The P4 always INSERTs a new row, so a re-learn would duplicate. Drop
          // any older row with the same device+label, keeping just this capture.
          await supabase
            .from("ir_signals")
            .delete()
            .eq("device", device)
            .eq("label", label)
            .neq("id", row.id);
          setStatus("success");
          toast.success("Learned", { description: label });
          onLearnedRef.current();
          setTimeout(() => onOpenChangeRef.current(false), 900);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, device, label]);

  // Visual countdown only — does NOT cancel the subscription, so a late capture
  // still wins after the bar runs out.
  useEffect(() => {
    if (!open || status !== "listening") return;
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const e = Date.now() - startedAt;
      setElapsed(e);
      if (e >= LEARN_TIMEOUT_MS) setStatus("timeout");
    }, 150);
    return () => clearInterval(tick);
  }, [open, status]);

  const pct = Math.min(100, (elapsed / LEARN_TIMEOUT_MS) * 100);
  const secondsLeft = Math.max(0, Math.ceil((LEARN_TIMEOUT_MS - elapsed) / 1000));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Learn “{label}”</DialogTitle>
          <DialogDescription>
            {device ?? "—"} · point the remote at the hub’s IR receiver
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
            <p className="text-sm font-medium">Learned!</p>
          </div>
        )}

        {status === "timeout" && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Still waiting on the hub. If you already pressed the remote, keep
              this open a few more seconds — it’ll finish on its own. Otherwise
              hold the remote closer and retry.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => device && startLearn(device, label)}>
                Retry
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
