import { useEffect, useState } from "react";
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
import { type IrDevice, type IrIcon } from "@/lib/supabase";
import { IR_ICONS, IR_DEVICES } from "./irIcons";

export function AddIrDialog({
  open,
  onOpenChange,
  defaultDevice = "tv",
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDevice?: IrDevice;
  onCreate: (device: IrDevice, label: string, icon: IrIcon) => void;
}) {
  const [device, setDevice] = useState<IrDevice>(defaultDevice);
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState<IrIcon>("power");

  useEffect(() => {
    if (open) {
      setDevice(defaultDevice);
      setLabel("");
      setIcon("power");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = () => {
    if (!label.trim()) return;
    onOpenChange(false);
    onCreate(device, label.trim(), icon);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add IR button</DialogTitle>
          <DialogDescription>
            Create a button, then point the original remote at the hub to learn it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Device</Label>
            <Select value={device} onValueChange={(v) => setDevice(v as IrDevice)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IR_DEVICES.map((d) => (
                  <SelectItem key={d.key} value={d.key}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ir-label">Label</Label>
            <Input
              id="ir-label"
              placeholder="Power, Volume +, Mute…"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="grid grid-cols-6 gap-2">
              {IR_ICONS.map(({ key, icon: Icon }) => (
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!label.trim()}>
            Add & Learn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
