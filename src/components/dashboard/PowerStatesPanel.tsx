import { useEffect, useMemo, useState } from "react";
import {
  supabase,
  sendPowerToggle,
  powerRefFromIr,
  powerRefFromRf,
  type PowerState,
  type IrSignal,
  type RfSignal,
} from "@/lib/supabase";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Trash2, Power as PowerIcon, Check } from "lucide-react";
import { toast } from "sonner";

export function PowerStatesPanel() {
  const [states, setStates] = useState<PowerState[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const refresh = async () => {
    const { data, error } = await supabase
      .from("power_states")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      toast.error("Couldn’t load devices", { description: error.message });
      return;
    }
    setStates((data ?? []) as PowerState[]);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const ch = supabase
      .channel("power_states_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "power_states" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const toggle = async (s: PowerState) => {
    setBusyRef(s.ref);
    const next = !s.is_on;
    // Optimistic
    setStates((cur) => cur.map((x) => (x.ref === s.ref ? { ...x, is_on: next } : x)));
    const sendRes = await sendPowerToggle(s.ref);
    if (sendRes.error) {
      toast.error("Send failed", { description: sendRes.error.message });
      setStates((cur) => cur.map((x) => (x.ref === s.ref ? { ...x, is_on: s.is_on } : x)));
      setBusyRef(null);
      return;
    }
    const { error } = await supabase
      .from("power_states")
      .update({ is_on: next, updated_at: new Date().toISOString() })
      .eq("ref", s.ref);
    if (error) toast.error("State save failed", { description: error.message });
    else toast.success(`${s.name} → ${next ? "ON" : "OFF"}`);
    setBusyRef(null);
  };

  const correctState = async (s: PowerState, value: boolean) => {
    if (s.is_on === value) return;
    setStates((cur) => cur.map((x) => (x.ref === s.ref ? { ...x, is_on: value } : x)));
    const { error } = await supabase
      .from("power_states")
      .update({ is_on: value, updated_at: new Date().toISOString() })
      .eq("ref", s.ref);
    if (error) {
      toast.error("Couldn’t correct state", { description: error.message });
      refresh();
      return;
    }
    toast.success(`Marked ${s.name} as ${value ? "ON" : "OFF"}`);
  };

  const untrack = async (s: PowerState) => {
    const { error } = await supabase.from("power_states").delete().eq("ref", s.ref);
    if (error) {
      toast.error("Untrack failed", { description: error.message });
      return;
    }
    toast.success("Untracked", { description: s.name });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Devices</h2>
          <p className="text-xs text-muted-foreground">
            Tracked on/off state. Scenes can target absolute states instead of toggling.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Track device
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border bg-secondary/40"
            />
          ))}
        </div>
      ) : states.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No tracked devices yet. Track an IR power button or any RF button to manage its
            on/off state.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {states.map((s) => (
            <div
              key={s.ref}
              className={`rounded-xl border bg-secondary/30 p-4 transition-colors ${
                s.is_on ? "border-primary/40" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      s.is_on
                        ? "bg-primary/15 text-primary"
                        : "bg-background/60 text-muted-foreground"
                    }`}
                  >
                    <PowerIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {s.ref.startsWith("rf:") ? "RF" : s.ref.startsWith("pc:") ? "PC" : "IR"} · {s.ref}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground"
                      aria-label="Options"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => correctState(s, true)}>
                      <Check className="mr-2 h-4 w-4" />
                      Mark as ON (no send)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => correctState(s, false)}>
                      <Check className="mr-2 h-4 w-4" />
                      Mark as OFF (no send)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => untrack(s)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Untrack
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {s.is_on ? "On" : "Off"}
                </span>
                <Switch
                  checked={s.is_on}
                  disabled={busyRef === s.ref}
                  onCheckedChange={() => toggle(s)}
                  aria-label={`Toggle ${s.name}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <TrackDeviceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        existing={states}
        onCreated={refresh}
      />
    </section>
  );
}

function TrackDeviceDialog({
  open,
  onOpenChange,
  existing,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing: PowerState[];
  onCreated: () => void;
}) {
  const [irPowers, setIrPowers] = useState<IrSignal[]>([]);
  const [rfBtns, setRfBtns] = useState<RfSignal[]>([]);
  const [ref, setRef] = useState<string>("");
  const [name, setName] = useState("");
  const [initialOn, setInitialOn] = useState(false);
  const [busy, setBusy] = useState(false);

  const takenRefs = useMemo(() => new Set(existing.map((s) => s.ref)), [existing]);

  useEffect(() => {
    if (!open) return;
    setRef("");
    setName("");
    setInitialOn(false);
    (async () => {
      const [irRes, rfRes] = await Promise.all([
        supabase.from("ir_signals").select("*").eq("icon", "power"),
        supabase.from("rf_signals").select("*").order("slot"),
      ]);
      setIrPowers((irRes.data ?? []) as IrSignal[]);
      setRfBtns((rfRes.data ?? []) as RfSignal[]);
    })();
  }, [open]);

  const options = useMemo(() => {
    const list: { ref: string; label: string }[] = [];
    if (!takenRefs.has("pc:power")) {
      list.push({ ref: "pc:power", label: "PC · Power button" });
    }
    for (const s of irPowers) {
      const r = powerRefFromIr(s.id);
      if (!takenRefs.has(r))
        list.push({ ref: r, label: `IR · ${s.device.toUpperCase()} ${s.label}` });
    }
    for (const s of rfBtns) {
      const r = powerRefFromRf(s.slot);
      if (!takenRefs.has(r))
        list.push({ ref: r, label: `RF · slot ${s.slot} · ${s.label}` });
    }
    return list;
  }, [irPowers, rfBtns, takenRefs]);

  const submit = async () => {
    if (!ref || !name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("power_states").insert({
      ref,
      name: name.trim(),
      is_on: initialOn,
    });
    setBusy(false);
    if (error) {
      toast.error("Couldn’t track device", { description: error.message });
      return;
    }
    toast.success("Tracking", { description: name.trim() });
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Track a device</DialogTitle>
          <DialogDescription>
            Pick a power button. Scenes will be able to set its absolute on/off state.
          </DialogDescription>
        </DialogHeader>

        {options.length === 0 ? (
          <p className="rounded-md border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
            No untracked power buttons available. Add an IR “power” button or an RF button
            first.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Button</label>
              <Select value={ref} onValueChange={setRef}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a button…" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.ref} value={o.ref}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Display name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Living room TV"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Currently on?</p>
                <p className="text-xs text-muted-foreground">
                  Sets the starting state. No command is sent.
                </p>
              </div>
              <Switch checked={initialOn} onCheckedChange={setInitialOn} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!ref || !name.trim() || busy}>
            {busy ? "Saving…" : "Track"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
