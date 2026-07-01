import { useEffect, useMemo, useState } from "react";
import {
  supabase,
  powerRefFromIr,
  powerRefFromRf,
  type RfSignal,
  type IrSignal,
  type Scene,
  type SceneIcon,
  type SceneStep,
  type PowerState,
} from "@/lib/supabase";
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
import { SCENE_ICONS } from "./sceneIcons";
import { iconFor as rfIconFor } from "./rfIcons";
import { irIconFor } from "./irIcons";
import {
  Radio,
  Tv,
  Timer,
  X,
  ArrowUp,
  ArrowDown,
  Plus,
  Power as PowerIcon,
} from "lucide-react";
import { toast } from "sonner";


type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  scene: Scene | null; // null = create
  forJarvis?: boolean;
  onSaved: () => void;
};

const DELAY_PRESETS = [500, 1000, 2000, 3000, 5000];

type PowerStep = Extract<SceneStep, { kind: "power" }>;
type NonPowerStep = Exclude<SceneStep, { kind: "power" }>;

export function SceneBuilderDialog({ open, onOpenChange, scene, onSaved }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<SceneIcon>("film");
  // Initial device states (always run first, only sends if device isn't already in desired state)
  const [initialStates, setInitialStates] = useState<PowerStep[]>([]);
  // Sequential steps (RF / IR / delay) run after all initial states
  const [steps, setSteps] = useState<NonPowerStep[]>([]);
  const [rf, setRf] = useState<RfSignal[]>([]);
  const [ir, setIr] = useState<IrSignal[]>([]);
  const [tracked, setTracked] = useState<PowerState[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(scene?.name ?? "");
    setIcon(scene?.icon ?? "film");
    const all = scene?.steps ?? [];
    setInitialStates(all.filter((s): s is PowerStep => s.kind === "power"));
    setSteps(all.filter((s): s is NonPowerStep => s.kind !== "power"));
    (async () => {
      const [rfRes, irRes, psRes] = await Promise.all([
        supabase.from("rf_signals").select("*").order("slot"),
        supabase.from("ir_signals").select("*").order("device").order("created_at"),
        supabase.from("power_states").select("*").order("name"),
      ]);
      setRf((rfRes.data ?? []) as RfSignal[]);
      setIr((irRes.data ?? []) as IrSignal[]);
      setTracked((psRes.data ?? []) as PowerState[]);
    })();
  }, [open, scene]);


  const learnedRf = useMemo(() => rf.filter((s) => s.learned), [rf]);
  const learnedIr = useMemo(() => ir.filter((s) => (s.code?.length ?? 0) > 0), [ir]);

  const addStep = (s: NonPowerStep) => setSteps((cur) => [...cur, s]);
  const removeStep = (i: number) =>
    setSteps((cur) => cur.filter((_, idx) => idx !== i));
  const moveStep = (i: number, dir: -1 | 1) =>
    setSteps((cur) => {
      const next = [...cur];
      const j = i + dir;
      if (j < 0 || j >= next.length) return cur;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const setInitialState = (d: PowerState, desired: boolean) =>
    setInitialStates((cur) => {
      const without = cur.filter((s) => s.ref !== d.ref);
      return [...without, { kind: "power", ref: d.ref, name: d.name, desired }];
    });
  const clearInitialState = (ref: string) =>
    setInitialStates((cur) => cur.filter((s) => s.ref !== ref));
  const initialFor = (ref: string): boolean | null =>
    initialStates.find((s) => s.ref === ref)?.desired ?? null;

  const save = async () => {
    if (!name.trim()) return;
    if (initialStates.length === 0 && steps.length === 0) {
      toast.error("Add at least one initial state or step");
      return;
    }
    setSaving(true);
    try {
      // Initial states first, then sequential steps. Runner already executes in order.
      const merged: SceneStep[] = [...initialStates, ...steps];
      const payload = { name: name.trim(), icon, steps: merged };
      const res = scene
        ? await supabase.from("scenes").update(payload).eq("id", scene.id)
        : await supabase.from("scenes").insert(payload);
      if (res.error) throw res.error;
      toast.success(scene ? "Scene updated" : "Scene created", { description: name.trim() });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error("Save failed", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{scene ? "Edit scene" : "New scene"}</DialogTitle>
          <DialogDescription>
            Build a sequence of remote commands. Steps run in order, top to bottom.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Movie mode"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Icon</label>
            <div className="grid grid-cols-6 gap-2">
              {SCENE_ICONS.map(({ key, icon: Icon }) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setIcon(key)}
                  aria-label={key}
                  className={`flex aspect-square items-center justify-center rounded-lg border transition-colors ${
                    icon === key
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>

          {/* ── Phase 1: initial device states ── */}
          <div className="space-y-2 rounded-xl border border-border bg-secondary/20 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <label className="text-xs font-medium text-foreground">
                1. Initial device states ({initialStates.length})
              </label>
              <span className="text-[11px] text-muted-foreground">
                Runs first. Only sends a toggle if the device isn't already there.
              </span>
            </div>
            {tracked.length === 0 ? (
              <p className="text-xs text-muted-foreground/70">
                No tracked devices. Add some on the Devices page.
              </p>
            ) : (
              <div className="space-y-1.5">
                {tracked.map((d) => {
                  const desired = initialFor(d.ref);
                  const btn = (active: boolean, on: boolean) =>
                    `rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                      active
                        ? on
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-destructive bg-destructive/15 text-destructive"
                        : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
                    }`;
                  return (
                    <div
                      key={d.ref}
                      className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-1.5"
                    >
                      <PowerIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate text-xs">{d.name}</span>
                      <button
                        type="button"
                        onClick={() => setInitialState(d, true)}
                        className={btn(desired === true, true)}
                      >
                        ON
                      </button>
                      <button
                        type="button"
                        onClick={() => setInitialState(d, false)}
                        className={btn(desired === false, false)}
                      >
                        OFF
                      </button>
                      <button
                        type="button"
                        onClick={() => clearInitialState(d.ref)}
                        disabled={desired === null}
                        className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        Skip
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Phase 2: sequential steps ── */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">
              2. Sequential steps ({steps.length})
            </label>
            {steps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No steps yet — add some below.
              </div>
            ) : (
              <ol className="space-y-2">
                {steps.map((s, i) => {
                  const Icon =
                    s.kind === "rf"
                      ? rfIconFor(rf.find((r) => r.slot === s.slot)?.icon ?? "power")
                      : s.kind === "ir"
                        ? irIconFor(ir.find((r) => r.id === s.signal_id)?.icon ?? "power")
                        : Timer;
                  const label =
                    s.kind === "delay"
                      ? `Wait ${s.ms} ms`
                      : s.kind === "rf"
                        ? `RF · ${s.label}`
                        : `IR · ${s.label}`;

                  return (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                        {i + 1}
                      </span>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm">{label}</span>
                      <button
                        type="button"
                        onClick={() => moveStep(i, -1)}
                        disabled={i === 0}
                        className="rounded p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(i, 1)}
                        disabled={i === steps.length - 1}
                        className="rounded p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(i)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        aria-label="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">Add a sequential step</p>

            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Radio className="h-3.5 w-3.5" /> RF remote
              </div>
              {learnedRf.length === 0 ? (
                <p className="text-xs text-muted-foreground/70">No learned RF signals.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {learnedRf.map((s) => {
                    const Icon = rfIconFor(s.icon);
                    return (
                      <button
                        key={s.slot}
                        type="button"
                        onClick={() =>
                          addStep({ kind: "rf", slot: s.slot, label: s.label })
                        }
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs hover:border-primary hover:text-primary"
                      >
                        <Plus className="h-3 w-3" />
                        <Icon className="h-3.5 w-3.5" />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Tv className="h-3.5 w-3.5" /> IR remote
              </div>
              {learnedIr.length === 0 ? (
                <p className="text-xs text-muted-foreground/70">No learned IR signals.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {learnedIr.map((s) => {
                    const Icon = irIconFor(s.icon);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          addStep({ kind: "ir", signal_id: s.id, label: `${s.device.toUpperCase()} ${s.label}` })
                        }
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs hover:border-primary hover:text-primary"
                      >
                        <Plus className="h-3 w-3" />
                        <Icon className="h-3.5 w-3.5" />
                        {s.device}·{s.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>



            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Timer className="h-3.5 w-3.5" /> Delay
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DELAY_PRESETS.map((ms) => (
                  <button
                    key={ms}
                    type="button"
                    onClick={() => addStep({ kind: "delay", ms })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs hover:border-primary hover:text-primary"
                  >
                    <Plus className="h-3 w-3" />
                    {ms < 1000 ? `${ms}ms` : `${ms / 1000}s`}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!name.trim() || saving}>
            {saving ? "Saving…" : scene ? "Save scene" : "Create scene"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
