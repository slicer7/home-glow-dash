import { useEffect, useMemo, useState } from "react";
import { supabase, type RfSignal, type RfIcon } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Fan,
  Lightbulb,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { iconFor } from "./rfIcons";
import { AddControlDialog } from "./AddControlDialog";
import { LearnModal } from "./LearnModal";
import { toast } from "sonner";

type GroupKey = "fan" | "lights";
type Group = {
  key: GroupKey;
  label: string;
  icon: LucideIcon;
  match: (s: RfSignal) => boolean;
};

const GROUPS: Group[] = [
  {
    key: "fan",
    label: "Fan",
    icon: Fan,
    match: (s) => s.icon === "fan",
  },
  {
    key: "lights",
    label: "Lights",
    icon: Lightbulb,
    match: (s) => s.icon !== "fan",
  },
];

export function RfRemoteGrid() {
  const [signals, setSignals] = useState<RfSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulsedSlot, setPulsedSlot] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [learn, setLearn] = useState<{ slot: number; label: string } | null>(null);
  const [renaming, setRenaming] = useState<RfSignal | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

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
      .channel("rf_signals_remote_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rf_signals" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const grouped = useMemo(
    () =>
      GROUPS.map((g) => ({
        group: g,
        items: signals.filter(g.match),
      })),
    [signals],
  );

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

  const saveRename = async () => {
    if (!renaming || !renameValue.trim()) return;
    const { error } = await supabase
      .from("rf_signals")
      .update({ label: renameValue.trim() })
      .eq("slot", renaming.slot);
    if (error) {
      toast.error("Rename failed", { description: error.message });
      return;
    }
    toast.success("Renamed", { description: renameValue.trim() });
    setRenaming(null);
    refresh();
  };

  const renderKey = (sig: RfSignal) => {
    const Icon = iconFor(sig.icon);
    const pulsed = pulsedSlot === sig.slot;
    const disabled = !sig.learned;
    const isPower = sig.icon === "power";
    const isDragging = dragSlot === sig.slot;
    const isOver = dragOverSlot === sig.slot && dragSlot !== null && dragSlot !== sig.slot;
    return (
      <div
        key={sig.slot}
        draggable
        onDragStart={(e) => {
          setDragSlot(sig.slot);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnter={() => setDragOverSlot(sig.slot)}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDragEnd={() => {
          setDragSlot(null);
          setDragOverSlot(null);
        }}
        className={`group relative flex cursor-grab flex-col items-center gap-1.5 rounded-xl p-1 transition-all active:cursor-grabbing ${
          isDragging ? "opacity-40" : ""
        } ${isOver ? "scale-110 bg-primary/10 ring-1 ring-primary" : ""}`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => send(sig)}
          aria-label={sig.label}
          className={`relative flex h-14 w-14 items-center justify-center rounded-full border transition-all ${
            isPower
              ? "border-red-500/40 bg-gradient-to-b from-red-500/30 to-red-700/20 text-red-400"
              : "border-white/10 bg-gradient-to-b from-zinc-700 to-zinc-900 text-zinc-100"
          } shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_4px_rgba(0,0,0,0.5)] ${
            pulsed ? "scale-95 brightness-150" : "active:scale-95"
          } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
          style={pulsed ? { boxShadow: "var(--emerald-glow)" } : undefined}
        >
          <Icon className="h-6 w-6" strokeWidth={1.8} />
          {disabled && (
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-zinc-900 bg-destructive" />
          )}
        </button>
        <span className="max-w-[68px] truncate text-[10px] font-medium uppercase tracking-wider text-zinc-400">
          {sig.label}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 opacity-0 transition-opacity hover:text-zinc-100 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              aria-label="Options"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setRenaming(sig);
                setRenameValue(sig.label);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLearn({ slot: sig.slot, label: sig.label })}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {sig.learned ? "Re-learn" : "Learn"}
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
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {loading
        ? Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-[420px] animate-pulse rounded-[2rem] border border-border bg-secondary/40"
            />
          ))
        : grouped.map(({ group, items }) => {
            const GroupIcon = group.icon;
            const powerBtn = items.find((s) => s.icon === "power");
            const otherBtns = items.filter((s) => s.slot !== powerBtn?.slot);
            return (
              <section
                key={group.key}
                className="relative mx-auto w-full max-w-[300px] rounded-[2rem] border border-zinc-800 bg-gradient-to-b from-zinc-900 to-black p-5 pt-6 shadow-2xl"
              >
                <div className="mx-auto mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
                      <GroupIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300">
                      {group.label}
                    </div>
                  </div>
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      pulsedSlot !== null && items.some((s) => s.slot === pulsedSlot)
                        ? "bg-primary shadow-[0_0_8px_var(--color-primary)]"
                        : "bg-zinc-700"
                    }`}
                  />
                </div>

                <div className="mb-5 flex justify-center border-b border-zinc-800/80 pb-5">
                  {powerBtn ? (
                    renderKey(powerBtn)
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 opacity-50">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-zinc-700 text-zinc-600">
                        <Plus className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                        Power
                      </span>
                    </div>
                  )}
                </div>

                {otherBtns.length === 0 && !powerBtn ? (
                  <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center">
                    <p className="text-xs text-zinc-500">
                      No {group.label.toLowerCase()} buttons yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 justify-items-center gap-x-2 gap-y-4">
                    {otherBtns.map(renderKey)}
                  </div>
                )}

                <div className="mt-6 flex justify-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAddOpen(true)}
                    className="gap-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add button
                  </Button>
                </div>
              </section>
            );
          })}

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

      <Dialog open={renaming !== null} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename control</DialogTitle>
            <DialogDescription>Slot {renaming?.slot}</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Control name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={saveRename} disabled={!renameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
