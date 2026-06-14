import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase, type RfIcon, type RfSignal } from "@/lib/supabase";
import { RF_ICONS } from "./rfIcons";
import { toast } from "sonner";

const ALL_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7];

export function AddControlDialog({
  open,
  onOpenChange,
  existing,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: RfSignal[];
  onCreated: (slot: number, label: string) => void;
}) {
  const usedSlots = useMemo(() => new Set(existing.map((s) => s.slot)), [existing]);
  const freeSlots = ALL_SLOTS.filter((s) => !usedSlots.has(s));
  const allFull = freeSlots.length === 0;

  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState<RfIcon>("lightbulb");
  const [slot, setSlot] = useState<number | null>(freeSlots[0] ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel("");
      setIcon("lightbulb");
      setSlot(freeSlots[0] ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    if (slot === null || !label.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("rf_signals").insert({
      slot,
      label: label.trim(),
      icon,
      learned: false,
    });
    setBusy(false);
    if (error) {
      toast.error("Couldn’t add control", { description: error.message });
      return;
    }
    onOpenChange(false);
    onCreated(slot, label.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add control</DialogTitle>
          <DialogDescription>
            Create a new RF remote slot. You’ll learn the signal next.
          </DialogDescription>
        </DialogHeader>

        {allFull ? (
          <p className="rounded-md border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
            All 8 slots are full. Delete one to free up space.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rf-label">Label</Label>
              <Input
                id="rf-label"
                placeholder="Ceiling light"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="grid grid-cols-6 gap-2">
                {RF_ICONS.map(({ key, icon: Icon }) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setIcon(key)}
                    className={`flex aspect-square items-center justify-center rounded-lg border transition-colors ${
                      icon === key
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                    }`}
                    aria-label={key}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Slot</Label>
              <Select
                value={slot !== null ? String(slot) : undefined}
                onValueChange={(v) => setSlot(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_SLOTS.map((s) => (
                    <SelectItem key={s} value={String(s)} disabled={usedSlots.has(s)}>
                      Slot {s}
                      {usedSlots.has(s) ? " · in use" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={allFull || busy || !label.trim() || slot === null}
          >
            {busy ? "Adding…" : "Add & Learn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
