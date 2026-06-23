import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Power, ZapOff } from "lucide-react";
import { toast } from "sonner";

export function PcPowerCard() {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sendPress = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("commands")
      .insert({ target_device: "pc_power", command: "press" });
    setBusy(false);
    if (error) {
      toast.error("PC power failed", { description: error.message });
      return;
    }
    toast.success("PC power sent");
  };

  const sendForceOff = async () => {
    setConfirmOpen(false);
    setBusy(true);
    const { error } = await supabase
      .from("commands")
      .insert({ target_device: "pc_power", command: "force_off" });
    setBusy(false);
    if (error) {
      toast.error("Force off failed", { description: error.message });
      return;
    }
    toast.success("Force off sent");
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold">PC Power</h2>
        <p className="text-xs text-muted-foreground">
          Toggle or force your PC off remotely.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          onClick={sendPress}
          disabled={busy}
          className="gap-2"
        >
          <Power className="h-4 w-4" />
          Power
        </Button>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" disabled={busy} className="gap-1.5 text-muted-foreground hover:text-destructive">
              <ZapOff className="h-4 w-4" />
              Force Off
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Force the PC off?</AlertDialogTitle>
              <AlertDialogDescription>
                This will send an immediate force-off command. Unsaved work may be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={sendForceOff} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Force Off
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
