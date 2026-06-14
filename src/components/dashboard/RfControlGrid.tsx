import { useEffect, useState } from "react";
import { supabase, type RfSignal } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Radio, RefreshCw, Trash2 } from "lucide-react";
import { iconFor } from "./rfIcons";
import { toast } from "sonner";
import { AddControlDialog } from "./AddControlDialog";
import { LearnModal } from "./LearnModal";

export function RfControlGrid() {
  const [signals, setSignals] = useState<RfSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulsedSlot, setPulsedSlot] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [learn, setLearn] = useState<{ slot: number; label: string } | null>(null);

  const refresh = async () => {
    const { data, error } = await supabase
      .from("rf_signals")
      .select("*")
      .order("slot", { ascending: true });
    if (error) {
      toast.error("Couldn’t load controls", { description: error.message });
      return;
    }
    setSignals((data ?? []) as RfSignal[]);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));

    const channel = supabase
      .channel("rf_signals_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rf_signals" },
        () => {
          refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const send = async (sig: RfSignal) => {
    setPulsedSlot(sig.slot);
    setTimeout(() => setPulsedSlot((s) => (s === sig.slot ? null : s)), 700);
    toast.success("Sent ✓", { description: sig.label });
    const { error } = await supabase.from("commands").insert({
      target_device: "p4_hub",
      command: "rf_send",
      params: { slot: sig.slot },
    });
    if (error) toast.error("Send failed", { description: error.message });
  };

  const remove = async (sig: RfSignal) => {
    const { error } = await supabase.from("rf_signals").delete().eq("slot", sig.slot);
    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    toast.success("Deleted", { description: sig.label });
    refresh();
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Radio className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">RF Remote Controls</h2>
            <p className="text-xs text-muted-foreground">
              433.92 MHz · {signals.length}/8 slots used
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add control
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-border bg-secondary/40"
            />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No controls yet. Add one to start binding your remotes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {signals.map((sig) => {
            const Icon = iconFor(sig.icon);
            const pulsed = pulsedSlot === sig.slot;
            const disabled = !sig.learned;
            return (
              <div
                key={sig.slot}
                className={`group relative overflow-hidden rounded-xl border transition-all ${
                  pulsed
                    ? "scale-[1.02] border-primary bg-primary/15"
                    : "border-border bg-secondary/30"
                }`}
                style={pulsed ? { boxShadow: "var(--emerald-glow)" } : undefined}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => send(sig)}
                  className={`flex w-full flex-col items-center gap-3 px-4 py-6 text-center ${
                    disabled
                      ? "cursor-not-allowed opacity-60"
                      : "active:scale-[0.98]"
                  }`}
                >
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-full ${
                      pulsed
                        ? "bg-primary text-primary-foreground"
                        : "bg-background/60 text-foreground"
                    }`}
                  >
                    <Icon className="h-7 w-7" strokeWidth={1.6} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{sig.label}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Slot {sig.slot}
                    </p>
                  </div>
                </button>

                {!sig.learned && (
                  <div className="px-4 pb-4">
                    <div className="mb-2 rounded-full bg-destructive/15 px-2 py-0.5 text-center text-[10px] font-medium uppercase tracking-wider text-destructive">
                      Not learned
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLearn({ slot: sig.slot, label: sig.label });
                      }}
                    >
                      Learn
                    </Button>
                  </div>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Options"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setLearn({ slot: sig.slot, label: sig.label })}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Re-learn
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => remove(sig)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      <AddControlDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        existing={signals}
        onCreated={(slot, label) => setLearn({ slot, label })}
      />

      <LearnModal
        open={learn !== null}
        slot={learn?.slot ?? null}
        label={learn?.label ?? ""}
        onOpenChange={(o) => !o && setLearn(null)}
        onLearned={refresh}
      />
    </section>
  );
}
