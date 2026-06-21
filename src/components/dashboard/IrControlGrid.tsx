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

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-border bg-secondary/40"
            />
          ))}
        </div>
      ) : (
        grouped.map(({ device, items }) => {
          const DeviceIcon = device.icon;
          return (
            <section
              key={device.key}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <DeviceIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">{device.label}</h2>
                    <p className="text-xs text-muted-foreground">
                      {items.length} {items.length === 1 ? "button" : "buttons"}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startAdd(device.key)}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No buttons yet — add one and learn it from the remote.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  {items.map((sig) => {
                    const Icon = irIconFor(sig.icon);
                    const pulsed = pulsedId === sig.id;
                    const empty = !sig.code || sig.code.length === 0;
                    return (
                      <div
                        key={sig.id}
                        className={`group relative overflow-hidden rounded-xl border transition-all ${
                          pulsed
                            ? "scale-[1.02] border-primary bg-primary/15"
                            : "border-border bg-secondary/30"
                        }`}
                        style={pulsed ? { boxShadow: "var(--emerald-glow)" } : undefined}
                      >
                        <button
                          type="button"
                          disabled={empty}
                          onClick={() => send(sig)}
                          className={`flex w-full flex-col items-center gap-3 px-4 py-5 text-center ${
                            empty ? "cursor-not-allowed opacity-60" : "active:scale-[0.98]"
                          }`}
                        >
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-full ${
                              pulsed
                                ? "bg-primary text-primary-foreground"
                                : "bg-background/60 text-foreground"
                            }`}
                          >
                            <Icon className="h-6 w-6" strokeWidth={1.6} />
                          </div>
                          <p className="w-full truncate text-sm font-semibold">
                            {sig.label}
                          </p>
                        </button>

                        {empty && (
                          <div className="px-3 pb-3">
                            <div className="mb-2 rounded-full bg-destructive/15 px-2 py-0.5 text-center text-[10px] font-medium uppercase tracking-wider text-destructive">
                              Not learned
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                relearn(sig);
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
                  })}
                </div>
              )}
            </section>
          );
        })
      )}

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
