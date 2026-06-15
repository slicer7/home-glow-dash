import { useEffect, useState, lazy, Suspense } from "react";
import { supabase, type RfSignal, type RfIcon } from "@/lib/supabase";

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
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function RoomView() {
  const [signals, setSignals] = useState<RfSignal[]>([]);
  const [mounted, setMounted] = useState(false); /* gate WebGL to the client */
  const [addOpen, setAddOpen] = useState(false);
  const [learn, setLearn] = useState<{ slot: number; label: string } | null>(null);

  const [edit, setEdit] = useState<RfSignal | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editIcon, setEditIcon] = useState<RfIcon>("lightbulb");

  useEffect(() => setMounted(true), []);

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
    refresh();
    const ch = supabase
      .channel("rf_room")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rf_signals" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const send = async (sig: RfSignal) => {
    toast.success("Sent ✓", { description: sig.label });
    const { error } = await supabase.from("commands").insert({
      target_device: "p4_hub",
      command: "rf_send",
      params: { slot: sig.slot },
    });
    if (error) toast.error("Send failed", { description: error.message });
  };

  const openEdit = (sig: RfSignal) => {
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
          {signals.length === 0
            ? "No controls yet — add your first device"
            : "Drag to look around · scroll to zoom · tap a control to send"}
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="pointer-events-auto gap-1.5 shadow-lg"
        >
          <Plus className="h-4 w-4" />
          Add device
        </Button>
      </div>

      {mounted ? (
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Loading 3D room…
            </div>
          }
        >
          <Room3D signals={signals} onSend={send} onEdit={openEdit} />
        </Suspense>
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Loading 3D room…
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
