import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRoomState } from "@/lib/useRoomLocked";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Unlock, Save } from "lucide-react";
import { toast } from "sonner";

export function RoomLockCard() {
  const { state, locked, loading } = useRoomState();
  const [code, setCode] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCode(state?.screen_code ?? "");
  }, [state?.screen_code]);

  const codeValid = /^\d{4}$/.test(code);
  const codeDirty = code !== (state?.screen_code ?? "");

  const saveCode = async () => {
    if (!codeValid) {
      toast.error("Code must be exactly 4 digits");
      return;
    }
    setSavingCode(true);
    const { error } = await supabase
      .from("room_state")
      .update({ screen_code: code, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSavingCode(false);
    if (error) toast.error("Couldn’t save code", { description: error.message });
    else toast.success("P4 screen code saved");
  };

  const setLocked = async (value: boolean) => {
    setBusy(true);
    const { error } = await supabase
      .from("room_state")
      .update({ locked: value, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setBusy(false);
    if (error) toast.error("Couldn’t update lock", { description: error.message });
    else toast.success(value ? "Room locked" : "Room unlocked");
  };

  return (
    <section className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Room Lock</h2>
          <p className="text-xs text-muted-foreground">
            Live status from the door hub. The P4 screen code unlocks the touchscreen view while
            the room is locked.
          </p>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
            loading
              ? "border-border bg-secondary/40 text-muted-foreground"
              : locked
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-primary/40 bg-primary/10 text-primary"
          }`}
        >
          {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          {loading ? "…" : locked ? "Locked" : "Unlocked"}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-4">
          <label className="text-xs font-medium text-muted-foreground">
            P4 screen code (4 digits)
          </label>
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              pattern="\d*"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="0000"
              className="font-mono tracking-[0.5em] text-center"
            />
            <Button
              onClick={saveCode}
              disabled={!codeValid || !codeDirty || savingCode}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Typed on the P4 touchscreen to view it while the room is locked.
          </p>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-4">
          <p className="text-xs font-medium text-muted-foreground">Manual control</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-1.5"
              disabled={busy || locked}
              onClick={() => setLocked(true)}
            >
              <Lock className="h-4 w-4" />
              Lock now
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-1.5"
              disabled={busy || !locked}
              onClick={() => setLocked(false)}
            >
              <Unlock className="h-4 w-4" />
              Unlock
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            The door hub normally writes this on lock/unlock — use only for overrides.
          </p>
        </div>
      </div>
    </section>
  );
}
