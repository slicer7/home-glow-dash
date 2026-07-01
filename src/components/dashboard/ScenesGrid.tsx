import { useEffect, useState } from "react";
import {
  supabase,
  sendPowerToggle,
  irTarget,
  type Scene,
  type SceneStep,
  type IrDevice,
} from "@/lib/supabase";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sceneIconFor } from "./sceneIcons";
import { MoreHorizontal, Pencil, Plus, Trash2, Play } from "lucide-react";
import { SceneBuilderDialog } from "./SceneBuilderDialog";
import { toast } from "sonner";

async function runStep(step: SceneStep): Promise<void> {
  if (step.kind === "delay") {
    return new Promise((r) => setTimeout(r, step.ms));
  }
  if (step.kind === "power") {
    const { data, error } = await supabase
      .from("power_states")
      .select("is_on")
      .eq("ref", step.ref)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const current = (data as { is_on: boolean } | null)?.is_on;
    if (current === step.desired) return; // already in desired state — skip
    const send = await sendPowerToggle(step.ref);
    if (send.error) throw new Error(send.error.message);
    const upd = await supabase
      .from("power_states")
      .update({ is_on: step.desired, updated_at: new Date().toISOString() })
      .eq("ref", step.ref);
    if (upd.error) throw new Error(upd.error.message);
    return;
  }
  let insert: { target_device: string; command: string; params: Record<string, unknown> };
  if (step.kind === "rf") {
    insert = { target_device: "p4_hub", command: "rf_send", params: { slot: step.slot } };
  } else {
    const { data } = await supabase
      .from("ir_signals")
      .select("device")
      .eq("id", step.signal_id)
      .maybeSingle();
    const device = ((data as { device: IrDevice } | null)?.device ?? "tv") as IrDevice;
    insert = {
      target_device: irTarget(device),
      command: "ir_send",
      params: { signal_id: step.signal_id },
    };
  }
  const { error } = await supabase.from("commands").insert(insert);
  if (error) throw new Error(error.message);
}


export function ScenesGrid({ forJarvis = false }: { forJarvis?: boolean } = {}) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editScene, setEditScene] = useState<Scene | null>(null);

  const refresh = async () => {
    const { data, error } = await supabase
      .from("scenes")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Couldn't load scenes", { description: error.message });
      return;
    }
    const all = (data ?? []) as Scene[];
    setScenes(
      forJarvis
        ? all.filter((s) => s.for_jarvis === true)
        : all.filter((s) => s.for_jarvis !== true),
    );
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const ch = supabase
      .channel("scenes_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scenes" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const run = async (scene: Scene) => {
    if (runningId) return;
    setRunningId(scene.id);
    toast.success(`Running “${scene.name}”`, {
      description: `${scene.steps.length} steps`,
    });
    try {
      for (const step of scene.steps) {
        await runStep(step);
      }
      toast.success("Scene complete ✓", { description: scene.name });
    } catch (e) {
      toast.error("Scene failed", { description: (e as Error).message });
    } finally {
      setRunningId(null);
    }
  };

  const remove = async (s: Scene) => {
    const { error } = await supabase.from("scenes").delete().eq("id", s.id);
    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    toast.success("Deleted", { description: s.name });
    refresh();
  };

  const openNew = () => {
    setEditScene(null);
    setBuilderOpen(true);
  };
  const openEdit = (s: Scene) => {
    setEditScene(s);
    setBuilderOpen(true);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Scenes</h2>
          <p className="text-xs text-muted-foreground">
            One tap to fire a sequence of RF + IR commands.
          </p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New scene
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-border bg-secondary/40"
            />
          ))}
        </div>
      ) : scenes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No scenes yet. Create one — e.g. <span className="text-foreground">Movie mode</span>:
            lights off → TV on → AC cool.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
          {scenes.map((s) => {
            const Icon = sceneIconFor(s.icon);
            const running = runningId === s.id;
            return (
              <div
                key={s.id}
                className={`group relative overflow-hidden rounded-xl border transition-all ${
                  running
                    ? "scale-[1.02] border-primary bg-primary/15"
                    : "border-border bg-secondary/30"
                }`}
                style={running ? { boxShadow: "var(--emerald-glow)" } : undefined}
              >
                <button
                  type="button"
                  disabled={runningId !== null}
                  onClick={() => run(s)}
                  className="flex w-full flex-col items-center gap-3 px-4 py-5 text-center disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full ${
                      running
                        ? "bg-primary text-primary-foreground"
                        : "bg-background/60 text-foreground"
                    }`}
                  >
                    {running ? (
                      <Play className="h-6 w-6 animate-pulse" strokeWidth={2} />
                    ) : (
                      <Icon className="h-6 w-6" strokeWidth={1.6} />
                    )}
                  </div>
                  <div className="w-full">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {s.steps.length} {s.steps.length === 1 ? "step" : "steps"}
                    </p>
                    {forJarvis && s.description ? (
                      <p className="mt-1.5 line-clamp-3 text-[11px] text-muted-foreground/90">
                        {s.description}
                      </p>
                    ) : null}
                  </div>
                </button>

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
                    <DropdownMenuItem onClick={() => openEdit(s)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => remove(s)}
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

      <SceneBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        scene={editScene}
        onSaved={refresh}
      />
    </section>
  );
}
