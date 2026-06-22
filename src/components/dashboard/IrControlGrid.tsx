import { useEffect, useMemo, useState } from "react";
import { supabase, type IrSignal, type IrDevice, type IrIcon } from "@/lib/supabase";
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
import { MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { irIconFor, IR_ICONS, IR_DEVICES, deviceMeta } from "./irIcons";
import { AddIrDialog } from "./AddIrDialog";
import { IrLearnModal } from "./IrLearnModal";
import { toast } from "sonner";

type LearnTarget = { device: IrDevice; label: string; icon: IrIcon };

export function IrControlGrid() {
  const [signals, setSignals] = useState<IrSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulsedId, setPulsedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDevice, setAddDevice] = useState<IrDevice>("tv");
  const [learn, setLearn] = useState<LearnTarget | null>(null);

  const [edit, setEdit] = useState<IrSignal | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editIcon, setEditIcon] = useState<IrIcon>("power");

  const refresh = async () => {
    const { data, error } = await supabase
      .from("ir_signals")
      .select("*")
      .order("device", { ascending: true })
      .order("pos_x", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Couldn’t load IR buttons", { description: error.message });
      return;
    }
    setSignals((data ?? []) as IrSignal[]);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const channel = supabase
      .channel("ir_signals_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ir_signals" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const grouped = useMemo(() => {
    return IR_DEVICES.map((d) => ({
      device: d,
      items: signals.filter((s) => s.device === d.key),
    }));
  }, [signals]);

  const send = async (sig: IrSignal) => {
    setPulsedId(sig.id);
    setTimeout(() => setPulsedId((id) => (id === sig.id ? null : id)), 700);
    toast.success("Sent ✓", { description: sig.label });
    const { error } = await supabase.from("commands").insert({
      target_device: "clock",
      command: "ir_send",
      params: { signal_id: sig.id },
    });
    if (error) toast.error("Send failed", { description: error.message });
  };

  const remove = async (sig: IrSignal) => {
    const { error } = await supabase.from("ir_signals").delete().eq("id", sig.id);
    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    toast.success("Deleted", { description: sig.label });
    refresh();
  };

  const openEdit = (sig: IrSignal) => {
    setEdit(sig);
    setEditLabel(sig.label);
    setEditIcon(sig.icon);
  };

  const saveEdit = async () => {
    if (!edit || !editLabel.trim()) return;
    const { error } = await supabase
      .from("ir_signals")
      .update({ label: editLabel.trim(), icon: editIcon })
      .eq("id", edit.id);
    if (error) {
      toast.error("Save failed", { description: error.message });
      return;
    }
    toast.success("Saved", { description: editLabel.trim() });
    setEdit(null);
    refresh();
  };

  const relearn = (sig: IrSignal) => {
    setEdit(null);
    setLearn({ device: sig.device, label: sig.label, icon: sig.icon });
  };

  const startAdd = (device: IrDevice) => {
    setAddDevice(device);
    setAddOpen(true);
  };

  const renderKey = (sig: IrSignal) => {
    const Icon = irIconFor(sig.icon);
    const pulsed = pulsedId === sig.id;
    const empty = !sig.code || sig.code.length === 0;
    const isPower = sig.icon === "power";
    return (
      <div key={sig.id} className="group relative flex flex-col items-center gap-1.5">
        <button
          type="button"
          disabled={empty}
          onClick={() => send(sig)}
          aria-label={sig.label}
          className={`relative flex h-14 w-14 items-center justify-center rounded-full border transition-all ${
            isPower
              ? "border-red-500/40 bg-gradient-to-b from-red-500/30 to-red-700/20 text-red-400"
              : "border-white/10 bg-gradient-to-b from-zinc-700 to-zinc-900 text-zinc-100"
          } shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_4px_rgba(0,0,0,0.5)] ${
            pulsed ? "scale-95 brightness-150" : "active:scale-95"
          } ${empty ? "cursor-not-allowed opacity-40" : ""}`}
          style={pulsed ? { boxShadow: "var(--emerald-glow)" } : undefined}
        >
          <Icon className="h-6 w-6" strokeWidth={1.8} />
          {empty && (
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
            {empty && (
              <DropdownMenuItem onClick={() => relearn(sig)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Learn
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => openEdit(sig)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => relearn(sig)}>
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
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {loading
        ? Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[420px] animate-pulse rounded-[2rem] border border-border bg-secondary/40"
            />
          ))
        : grouped.map(({ device, items }) => {
            const DeviceIcon = device.icon;
            const powerBtn = items.find((s) => s.icon === "power");
            const otherBtns = items.filter((s) => s.id !== powerBtn?.id);
            return (
              <section
                key={device.key}
                className="relative mx-auto w-full max-w-[300px] rounded-[2rem] border border-zinc-800 bg-gradient-to-b from-zinc-900 to-black p-5 pt-6 shadow-2xl"
              >
                {/* speaker / IR LED strip */}
                <div className="mx-auto mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
                      <DeviceIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300">
                      {device.label}
                    </div>
                  </div>
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      pulsedId && items.some((s) => s.id === pulsedId)
                        ? "bg-primary shadow-[0_0_8px_var(--color-primary)]"
                        : "bg-zinc-700"
                    }`}
                  />
                </div>

                {/* power row */}
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

                {/* button grid */}
                {otherBtns.length === 0 && !powerBtn ? (
                  <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center">
                    <p className="text-xs text-zinc-500">
                      No buttons yet — tap “Add button” to learn one.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 justify-items-center gap-x-2 gap-y-4">
                    {otherBtns.map(renderKey)}
                  </div>
                )}

                {/* add button */}
                <div className="mt-6 flex justify-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startAdd(device.key)}
                    className="gap-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add button
                  </Button>
                </div>
              </section>
            );
          })}

      <AddIrDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultDevice={addDevice}
        onCreate={(device, label, icon) => setLearn({ device, label, icon })}
      />

      <IrLearnModal
        open={learn !== null}
        device={learn?.device ?? null}
        label={learn?.label ?? ""}
        icon={learn?.icon ?? "power"}
        onOpenChange={(o) => !o && setLearn(null)}
        onLearned={refresh}
      />

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit button</DialogTitle>
            <DialogDescription>
              {edit ? deviceMeta(edit.device).label : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              placeholder="Button name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
              }}
            />
            <div className="grid grid-cols-6 gap-2">
              {IR_ICONS.map(({ key, icon: Icon }) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setEditIcon(key)}
                  aria-label={key}
                  className={`flex aspect-square items-center justify-center rounded-lg border transition-colors ${
                    editIcon === key
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={!editLabel.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
