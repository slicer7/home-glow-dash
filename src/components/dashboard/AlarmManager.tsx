import { useEffect, useState } from "react";
import { supabase, type Alarm } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlarmClock, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

function fmtTime(hour: number, minute: number) {
  const h12 = ((hour + 11) % 12) + 1;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function toTimeInput(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

type EditState = { alarm: Alarm | null; time: string; label: string };

export function AlarmManager() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editState, setEditState] = useState<EditState>({
    alarm: null,
    time: "07:00",
    label: "Alarm",
  });

  const refresh = async () => {
    const { data, error } = await supabase
      .from("alarms")
      .select("*")
      .order("hour", { ascending: true })
      .order("minute", { ascending: true });
    if (error) {
      toast.error("Couldn’t load alarms", { description: error.message });
      return;
    }
    setAlarms((data ?? []) as Alarm[]);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const channel = supabase
      .channel("alarms_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alarms" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openAdd = () => {
    setEditState({ alarm: null, time: "07:00", label: "Alarm" });
    setDialogOpen(true);
  };

  const openEdit = (alarm: Alarm) => {
    setEditState({
      alarm,
      time: toTimeInput(alarm.hour, alarm.minute),
      label: alarm.label ?? "Alarm",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const [hStr, mStr] = editState.time.split(":");
    const hour = Number(hStr);
    const minute = Number(mStr);
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      toast.error("Pick a valid time");
      return;
    }
    const label = editState.label.trim() || "Alarm";

    if (editState.alarm) {
      const { error } = await supabase
        .from("alarms")
        .update({ hour, minute, label })
        .eq("id", editState.alarm.id);
      if (error) {
        toast.error("Save failed", { description: error.message });
        return;
      }
      toast.success("Alarm updated", { description: `${fmtTime(hour, minute)} · ${label}` });
    } else {
      const { error } = await supabase
        .from("alarms")
        .insert({ hour, minute, label, enabled: true });
      if (error) {
        toast.error("Add failed", { description: error.message });
        return;
      }
      toast.success("Alarm added", { description: `${fmtTime(hour, minute)} · ${label}` });
    }
    setDialogOpen(false);
    refresh();
  };

  const toggle = async (alarm: Alarm) => {
    // optimistic
    setAlarms((prev) =>
      prev.map((a) => (a.id === alarm.id ? { ...a, enabled: !a.enabled } : a)),
    );
    const { error } = await supabase
      .from("alarms")
      .update({ enabled: !alarm.enabled })
      .eq("id", alarm.id);
    if (error) {
      toast.error("Couldn’t update", { description: error.message });
      refresh();
    }
  };

  const remove = async (alarm: Alarm) => {
    const { error } = await supabase.from("alarms").delete().eq("id", alarm.id);
    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    toast.success("Alarm deleted");
    refresh();
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <AlarmClock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Alarms</h2>
            <p className="text-xs text-muted-foreground">
              {alarms.length} {alarms.length === 1 ? "alarm" : "alarms"} · rings on the clock
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add alarm
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-border bg-secondary/40"
            />
          ))}
        </div>
      ) : alarms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No alarms yet. Add one and it’ll ring on the bedside clock.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {alarms.map((a) => (
            <li
              key={a.id}
              className={`flex items-center gap-4 rounded-xl border border-border bg-secondary/30 px-4 py-3 transition-opacity ${
                a.enabled ? "" : "opacity-55"
              }`}
            >
              <Switch checked={a.enabled} onCheckedChange={() => toggle(a)} />
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums tracking-tight">
                    {fmtTime(a.hour, a.minute)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{a.label || "Alarm"}</p>
              </div>
              <button
                type="button"
                onClick={() => openEdit(a)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-foreground"
                aria-label="Edit alarm"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(a)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-destructive"
                aria-label="Delete alarm"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editState.alarm ? "Edit alarm" : "Add alarm"}</DialogTitle>
            <DialogDescription>The clock checks alarms every minute.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="alarm-time">Time</Label>
              <Input
                id="alarm-time"
                type="time"
                value={editState.time}
                onChange={(e) =>
                  setEditState((s) => ({ ...s, time: e.target.value }))
                }
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alarm-label">Label</Label>
              <Input
                id="alarm-label"
                placeholder="Wake up"
                value={editState.label}
                onChange={(e) =>
                  setEditState((s) => ({ ...s, label: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editState.alarm ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
