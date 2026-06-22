import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import {
  supabase,
  type RfSignal,
  type RfIcon,
  type IrSignal,
} from "@/lib/supabase";
import type { RoomControl } from "./Room3D";

/* Lazy + client-only: three.js / WebGL must not run during SSR. */
const Room3D = lazy(() =>
  import("./Room3D").then((m) => ({ default: m.Room3D })),
);
import { AddControlDialog } from "@/components/dashboard/AddControlDialog";
import { LearnModal } from "@/components/dashboard/LearnModal";
import { RF_ICONS } from "@/components/dashboard/rfIcons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Trash2, Move, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

/* Default marker positions (feet, room-centered) when a control hasn't been
 * placed yet — see Room3D for the coordinate frame. */
function rfDefault(i: number): [number, number, number] {
  return [-1.2 + i * 1.1, 6.6, 0]; // near the ceiling fan
}
function irDefault(device: string, i: number): [number, number, number] {
  if (device === "tv") return [4.9, 5.2 - i * 0.8, -3.9]; // by the TV
  if (device === "speaker") return [4.9, 3.2 - i * 0.8, -3.9]; // by the soundbar
  if (device === "ac") return [4.9, 3.3 - i * 0.8, 0.8]; // by the AC tower (next to desk)
  return [0, 4, 0];
}

function hasPos(s: { pos_x: number | null; pos_y: number | null; pos_z: number | null }) {
  return s.pos_x !== null && s.pos_y !== null && s.pos_z !== null;
}

export function RoomView() {
  const [rf, setRf] = useState<RfSignal[]>([]);
  const [ir, setIr] = useState<IrSignal[]>([]);
  const [mounted, setMounted] = useState(false); /* gate WebGL to the client */
  const [editing, setEditing] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [learn, setLearn] = useState<{ slot: number; label: string } | null>(null);

  const [edit, setEdit] = useState<RfSignal | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editIcon, setEditIcon] = useState<RfIcon>("lightbulb");

  /* Hidden controls in the 3D room — persisted to localStorage. */
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("room_hidden_keys");
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  });

  useEffect(() => setMounted(true), []);

  const refresh = async () => {
    const [rfRes, irRes] = await Promise.all([
      supabase.from("rf_signals").select("*").order("slot", { ascending: true }),
      supabase.from("ir_signals").select("*").order("created_at", { ascending: true }),
    ]);
    if (rfRes.error) toast.error("Couldn’t load RF controls", { description: rfRes.error.message });
    else setRf((rfRes.data ?? []) as RfSignal[]);
    if (irRes.error) toast.error("Couldn’t load IR controls", { description: irRes.error.message });
    else setIr((irRes.data ?? []) as IrSignal[]);
  };

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("room_controls")
      .on("postgres_changes", { event: "*", schema: "public", table: "rf_signals" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "ir_signals" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  /* Build the unified, positioned control list for the 3D view. */
  const controls = useMemo<RoomControl[]>(() => {
    const rfControls: RoomControl[] = rf.map((s, i) => ({
      key: `rf:${s.slot}`,
      kind: "rf",
      label: s.label,
      iconKey: s.icon,
      learned: s.learned,
      pos: hasPos(s) ? [s.pos_x!, s.pos_y!, s.pos_z!] : rfDefault(i),
    }));
    const perDevice: Record<string, number> = {};
    const irControls: RoomControl[] = ir.map((s) => {
      const i = perDevice[s.device] ?? 0;
      perDevice[s.device] = i + 1;
      return {
        key: `ir:${s.id}`,
        kind: "ir",
        label: s.label,
        iconKey: s.icon,
        learned: (s.code?.length ?? 0) > 0,
        pos: hasPos(s) ? [s.pos_x!, s.pos_y!, s.pos_z!] : irDefault(s.device, i),
      };
    });
    return [...rfControls, ...irControls];
  }, [rf, ir]);

  const send = async (c: RoomControl) => {
    toast.success("Sent ✓", { description: c.label });
    const insert: { target_device: string; command: string; params: Record<string, unknown> } =
      c.kind === "rf"
        ? { target_device: "p4_hub", command: "rf_send", params: { slot: Number(c.key.slice(3)) } }
        : { target_device: "clock", command: "ir_send", params: { signal_id: c.key.slice(3) } };
    const { error } = await supabase.from("commands").insert(insert);
    if (error) {
      toast.error("Send failed", { description: error.message });
      return;
    }
    // If this control is a tracked power device, flip its on/off state too, so
    // the 3D room stays in sync with the Remotes page and the P4. (c.key is
    // already the power_states ref: "rf:<slot>" or "ir:<id>".)
    const ref = c.key;
    const { data } = await supabase
      .from("power_states")
      .select("is_on")
      .eq("ref", ref)
      .maybeSingle();
    const current = (data as { is_on: boolean } | null)?.is_on;
    if (typeof current === "boolean") {
      await supabase
        .from("power_states")
        .update({ is_on: !current, updated_at: new Date().toISOString() })
        .eq("ref", ref);
    }
  };

  const move = async (c: RoomControl, pos: [number, number, number]) => {
    const [x, y, z] = pos.map((n) => Math.round(n * 1000) / 1000);
    if (c.kind === "rf") {
      const slot = Number(c.key.slice(3));
      const { error } = await supabase
        .from("rf_signals")
        .update({ pos_x: x, pos_y: y, pos_z: z })
        .eq("slot", slot);
      if (error) toast.error("Couldn’t save position", { description: error.message });
    } else {
      const id = c.key.slice(3);
      const { error } = await supabase
        .from("ir_signals")
        .update({ pos_x: x, pos_y: y, pos_z: z })
        .eq("id", id);
      if (error) toast.error("Couldn’t save position", { description: error.message });
    }
  };

  const openEdit = (c: RoomControl) => {
    const sig = rf.find((s) => `rf:${s.slot}` === c.key);
    if (!sig) return;
    setEdit(sig);
    setEditLabel(sig.label);
    setEditIcon(sig.icon);
  };

  const saveEdit = async () => {
    if (!edit || !editLabel.trim()) return;
    const { error } = await supabase
      .from("rf_signals")
      .update({ label: editLabel.trim(), icon: editIcon })
      .eq("slot", edit.slot);
    if (error) {
      toast.error("Save failed", { description: error.message });
      return;
    }
    toast.success("Saved", { description: editLabel.trim() });
    setEdit(null);
    refresh();
  };

  const removeCtrl = async () => {
    if (!edit) return;
    const { error } = await supabase.from("rf_signals").delete().eq("slot", edit.slot);
    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    toast.success("Deleted", { description: edit.label });
    setEdit(null);
    refresh();
  };

  const relearn = () => {
    if (!edit) return;
    const target = edit;
    setEdit(null);
    setLearn({ slot: target.slot, label: target.label });
  };

  return (
    <div className="relative h-[calc(100vh-65px)] w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex items-start justify-between px-4">
        <div className="pointer-events-auto rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
          {editing
            ? "Edit mode · drag a button onto its device, or click to select then nudge: arrows = N/E/S/W, space = up, shift = down"
            : "Drag to look · scroll to zoom · WASD to move, space/shift up/down · tap a control to send"}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={editing ? "default" : "outline"}
            onClick={() => setEditing((v) => !v)}
            className="pointer-events-auto gap-1.5 shadow-lg"
          >
            {editing ? <Check className="h-4 w-4" /> : <Move className="h-4 w-4" />}
            {editing ? "Done" : "Edit layout"}
          </Button>
          <Button onClick={() => setAddOpen(true)} className="pointer-events-auto gap-1.5 shadow-lg">
            <Plus className="h-4 w-4" />
            Add device
          </Button>
        </div>
      </div>

      {mounted ? (
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Loading 3D room…
            </div>
          }
        >
          <Room3D
            controls={controls}
            editing={editing}
            onSend={send}
            onEdit={openEdit}
            onMove={move}
          />
        </Suspense>
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Loading 3D room…
        </div>
      )}

      <AddControlDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        existing={rf}
        onCreated={(slot, label) => setLearn({ slot, label })}
      />
      <LearnModal
        open={learn !== null}
        slot={learn?.slot ?? null}
        label={learn?.label ?? ""}
        onOpenChange={(o) => !o && setLearn(null)}
        onLearned={refresh}
      />

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit control</DialogTitle>
            <DialogDescription>Slot {edit?.slot}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              placeholder="Control name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
              }}
            />
            <div className="grid grid-cols-6 gap-2">
              {RF_ICONS.map(({ key, icon: Icon }) => (
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
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1.5" onClick={relearn}>
                <RefreshCw className="h-4 w-4" />
                Re-learn
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-1.5 text-destructive focus:text-destructive"
                onClick={removeCtrl}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
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
