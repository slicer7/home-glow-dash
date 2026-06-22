import { useEffect, useMemo, useRef, useState } from "react";
import {
  supabase,
  type IrSignal,
  type RfSignal,
} from "@/lib/supabase";
import { irIconFor } from "@/components/dashboard/irIcons";
import { iconFor as rfIconFor } from "@/components/dashboard/rfIcons";
import { AddControlDialog } from "@/components/dashboard/AddControlDialog";
import { AddIrDialog } from "@/components/dashboard/AddIrDialog";
import { LearnModal } from "@/components/dashboard/LearnModal";
import { IrLearnModal } from "@/components/dashboard/IrLearnModal";
import type { IrDevice, IrIcon } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Pencil,
  Check,
  Plus,
  Type,
  Eye,
  EyeOff,
  Trash2,
  X,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchSetting,
  readLocal,
  saveSetting,
  subscribeSetting,
} from "@/lib/cloudSettings";

/* ------------------------------------------------------------------ */
/*  Layout / persistence                                              */
/* ------------------------------------------------------------------ */

const GRID = 56; // px per cell
const COLS = 12;
const MIN_ROWS = 14;
const SETTINGS_KEY = "custom_remote_layout_v1";

type ColorKey =
  | "graphite"
  | "crimson"
  | "amber"
  | "emerald"
  | "sky"
  | "violet"
  | "rose"
  | "slate";

const COLORS: Record<
  ColorKey,
  { face: string; ring: string; glow: string; swatch: string }
> = {
  graphite: {
    face: "from-zinc-700 to-zinc-950",
    ring: "ring-white/10",
    glow: "0 0 24px rgba(161,161,170,.35)",
    swatch: "linear-gradient(135deg,#52525b,#18181b)",
  },
  crimson: {
    face: "from-red-500/70 to-red-900",
    ring: "ring-red-300/30",
    glow: "0 0 28px rgba(239,68,68,.55)",
    swatch: "linear-gradient(135deg,#f87171,#7f1d1d)",
  },
  amber: {
    face: "from-amber-400/80 to-amber-800",
    ring: "ring-amber-200/30",
    glow: "0 0 26px rgba(245,158,11,.55)",
    swatch: "linear-gradient(135deg,#fbbf24,#78350f)",
  },
  emerald: {
    face: "from-emerald-400/70 to-emerald-900",
    ring: "ring-emerald-200/30",
    glow: "0 0 26px rgba(16,185,129,.55)",
    swatch: "linear-gradient(135deg,#34d399,#064e3b)",
  },
  sky: {
    face: "from-sky-400/70 to-sky-900",
    ring: "ring-sky-200/30",
    glow: "0 0 26px rgba(14,165,233,.55)",
    swatch: "linear-gradient(135deg,#38bdf8,#0c4a6e)",
  },
  violet: {
    face: "from-violet-400/70 to-violet-900",
    ring: "ring-violet-200/30",
    glow: "0 0 26px rgba(139,92,246,.55)",
    swatch: "linear-gradient(135deg,#a78bfa,#3b0764)",
  },
  rose: {
    face: "from-rose-400/70 to-rose-900",
    ring: "ring-rose-200/30",
    glow: "0 0 26px rgba(244,63,94,.55)",
    swatch: "linear-gradient(135deg,#fb7185,#881337)",
  },
  slate: {
    face: "from-slate-500 to-slate-900",
    ring: "ring-slate-200/20",
    glow: "0 0 24px rgba(100,116,139,.45)",
    swatch: "linear-gradient(135deg,#64748b,#0f172a)",
  },
};

type ButtonLayout = {
  x: number;
  y: number;
  size: 1 | 2 | 3; // cells
  color: ColorKey;
  hidden?: boolean;
};

type TextBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontSize: "sm" | "md" | "lg" | "xl";
  color: "muted" | "foreground" | "primary" | "amber" | "rose" | "sky";
  align: "left" | "center" | "right";
};

type Layout = {
  buttons: Record<string, ButtonLayout>;
  texts: TextBox[];
};

const TEXT_COLOR_CLASS: Record<TextBox["color"], string> = {
  muted: "text-zinc-500",
  foreground: "text-zinc-100",
  primary: "text-primary",
  amber: "text-amber-300",
  rose: "text-rose-300",
  sky: "text-sky-300",
};

const FONT_SIZE_CLASS: Record<TextBox["fontSize"], string> = {
  sm: "text-[11px]",
  md: "text-sm",
  lg: "text-lg",
  xl: "text-2xl",
};

function loadLayoutLocal(): Layout {
  const parsed = readLocal<Layout | null>(SETTINGS_KEY, null);
  if (!parsed) return { buttons: {}, texts: [] };
  return {
    buttons: parsed.buttons ?? {},
    texts: parsed.texts ?? [],
  };
}

function persistLayout(l: Layout) {
  saveSetting<Layout>(SETTINGS_KEY, l);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type RemoteItem = {
  ref: string;
  label: string;
  iconKey: string;
  isPower: boolean;
  kind: "ir" | "rf";
  signal: IrSignal | RfSignal;
};

export function CustomRemote() {
  const [irSignals, setIrSignals] = useState<IrSignal[]>([]);
  const [rfSignals, setRfSignals] = useState<RfSignal[]>([]);
  const [layout, setLayout] = useState<Layout>(() => loadLayoutLocal());
  const [editing, setEditing] = useState(false);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [pulsedRef, setPulsedRef] = useState<string | null>(null);

  const [addRfOpen, setAddRfOpen] = useState(false);
  const [addIrOpen, setAddIrOpen] = useState(false);
  const [rfLearn, setRfLearn] = useState<{ slot: number; label: string } | null>(null);
  const [irLearn, setIrLearn] = useState<
    { device: IrDevice; label: string; icon: IrIcon } | null
  >(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    kind: "button" | "text";
    id: string;
    offsetX: number;
    offsetY: number;
    pointerId: number;
  } | null>(null);

  /* ---------- data fetch ---------- */
  const refresh = async () => {
    const [ir, rf] = await Promise.all([
      supabase.from("ir_signals").select("*").order("created_at"),
      supabase.from("rf_signals").select("*").order("slot"),
    ]);
    if (!ir.error) setIrSignals((ir.data ?? []) as IrSignal[]);
    if (!rf.error) setRfSignals((rf.data ?? []) as RfSignal[]);
  };

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("custom_remote_signals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ir_signals" },
        () => refresh(),
      )
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

  /* ---------- cloud-synced layout ---------- */
  useEffect(() => {
    let alive = true;
    fetchSetting<Layout>(SETTINGS_KEY).then((cloud) => {
      if (!alive || !cloud) return;
      setLayout({
        buttons: cloud.buttons ?? {},
        texts: cloud.texts ?? [],
      });
    });
    const unsub = subscribeSetting<Layout>(SETTINGS_KEY, (next) => {
      setLayout({
        buttons: next.buttons ?? {},
        texts: next.texts ?? [],
      });
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  /* ---------- items & layout merge ---------- */
  const items: RemoteItem[] = useMemo(() => {
    const ir = irSignals.map<RemoteItem>((s) => ({
      ref: `ir:${s.id}`,
      label: s.label,
      iconKey: s.icon,
      isPower: s.icon === "power",
      kind: "ir",
      signal: s,
    }));
    const rf = rfSignals.map<RemoteItem>((s) => ({
      ref: `rf:${s.slot}`,
      label: s.label,
      iconKey: s.icon,
      isPower: s.icon === "power",
      kind: "rf",
      signal: s,
    }));
    return [...rf, ...ir];
  }, [irSignals, rfSignals]);

  // Auto-place buttons that don't yet have a layout entry.
  useEffect(() => {
    if (items.length === 0) return;
    const next: Record<string, ButtonLayout> = { ...layout.buttons };
    let changed = false;
    const occupied = new Set<string>();
    Object.values(next).forEach((b) => {
      if (b.hidden) return;
      for (let dx = 0; dx < b.size; dx++)
        for (let dy = 0; dy < b.size; dy++)
          occupied.add(`${b.x + dx},${b.y + dy}`);
    });
    const findFree = (): { x: number; y: number } => {
      for (let y = 0; y < 200; y++)
        for (let x = 0; x < COLS; x++)
          if (!occupied.has(`${x},${y}`)) return { x, y };
      return { x: 0, y: 0 };
    };
    items.forEach((it) => {
      if (next[it.ref]) return;
      const { x, y } = findFree();
      occupied.add(`${x},${y}`);
      next[it.ref] = {
        x,
        y,
        size: 1,
        color: it.isPower ? "crimson" : "graphite",
      };
      changed = true;
    });
    if (changed) {
      const merged = { ...layout, buttons: next };
      setLayout(merged);
      persistLayout(merged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const updateLayout = (mut: (l: Layout) => Layout) => {
    setLayout((prev) => {
      const next = mut(prev);
      persistLayout(next);
      return next;
    });
  };

  /* ---------- canvas height ---------- */
  const usedRows = useMemo(() => {
    let max = MIN_ROWS;
    Object.values(layout.buttons).forEach((b) => {
      if (b.hidden) return;
      max = Math.max(max, b.y + b.size);
    });
    layout.texts.forEach((t) => {
      max = Math.max(max, t.y + t.h);
    });
    return max + (editing ? 2 : 1);
  }, [layout, editing]);

  /* ---------- send ---------- */
  const send = async (it: RemoteItem) => {
    if (editing) {
      setSelectedRef(it.ref);
      setSelectedText(null);
      return;
    }
    setPulsedRef(it.ref);
    setTimeout(() => setPulsedRef((r) => (r === it.ref ? null : r)), 700);
    toast.success("Sent ✓", { description: it.label });
    if (it.kind === "rf") {
      const slot = (it.signal as RfSignal).slot;
      const { error } = await supabase.from("commands").insert({
        target_device: "p4_hub",
        command: "rf_send",
        params: { slot },
      });
      if (error) return toast.error("Send failed", { description: error.message });
      const ref = `rf:${slot}`;
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
    } else {
      const sig = it.signal as IrSignal;
      const { error } = await supabase.from("commands").insert({
        target_device: "clock",
        command: "ir_send",
        params: { signal_id: sig.id },
      });
      if (error) return toast.error("Send failed", { description: error.message });
      if (sig.icon === "power") {
        const ref = `ir:${sig.id}`;
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
      }
    }
  };

  /* ---------- drag ---------- */
  const onPointerDown = (
    e: React.PointerEvent,
    kind: "button" | "text",
    id: string,
  ) => {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    dragRef.current = {
      kind,
      id,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      pointerId: e.pointerId,
    };
    target.setPointerCapture(e.pointerId);
    if (kind === "button") {
      setSelectedRef(id);
      setSelectedText(null);
    } else {
      setSelectedText(id);
      setSelectedRef(null);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const relX = e.clientX - canvasRect.left - d.offsetX;
    const relY = e.clientY - canvasRect.top - d.offsetY;
    const cellX = Math.max(0, Math.round(relX / GRID));
    const cellY = Math.max(0, Math.round(relY / GRID));
    if (d.kind === "button") {
      updateLayout((l) => {
        const b = l.buttons[d.id];
        if (!b) return l;
        const x = Math.min(cellX, COLS - b.size);
        return { ...l, buttons: { ...l.buttons, [d.id]: { ...b, x, y: cellY } } };
      });
    } else {
      updateLayout((l) => {
        const t = l.texts.find((x) => x.id === d.id);
        if (!t) return l;
        const x = Math.min(cellX, COLS - t.w);
        return {
          ...l,
          texts: l.texts.map((tx) => (tx.id === d.id ? { ...tx, x, y: cellY } : tx)),
        };
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(
          dragRef.current.pointerId,
        );
      } catch {
        /* noop */
      }
    }
    dragRef.current = null;
  };

  /* ---------- inspector actions ---------- */
  const selectedButton = selectedRef ? layout.buttons[selectedRef] : null;
  const selectedItem = items.find((i) => i.ref === selectedRef) ?? null;
  const selectedTextBox =
    layout.texts.find((t) => t.id === selectedText) ?? null;

  const setBtn = (mut: (b: ButtonLayout) => ButtonLayout) => {
    if (!selectedRef) return;
    updateLayout((l) => {
      const b = l.buttons[selectedRef];
      if (!b) return l;
      return { ...l, buttons: { ...l.buttons, [selectedRef]: mut(b) } };
    });
  };

  const setTxt = (mut: (t: TextBox) => TextBox) => {
    if (!selectedText) return;
    updateLayout((l) => ({
      ...l,
      texts: l.texts.map((t) => (t.id === selectedText ? mut(t) : t)),
    }));
  };

  const hideButton = () => {
    if (!selectedRef) return;
    setBtn((b) => ({ ...b, hidden: true }));
    setSelectedRef(null);
  };

  const showAll = () => {
    updateLayout((l) => ({
      ...l,
      buttons: Object.fromEntries(
        Object.entries(l.buttons).map(([k, b]) => [k, { ...b, hidden: false }]),
      ),
    }));
  };

  const addTextBox = () => {
    const id = `t_${Date.now().toString(36)}`;
    const t: TextBox = {
      id,
      x: 0,
      y: usedRows - 2,
      w: 4,
      h: 1,
      text: "Label",
      fontSize: "md",
      color: "muted",
      align: "left",
    };
    updateLayout((l) => ({ ...l, texts: [...l.texts, t] }));
    setSelectedText(id);
    setSelectedRef(null);
  };

  const deleteTextBox = () => {
    if (!selectedText) return;
    updateLayout((l) => ({
      ...l,
      texts: l.texts.filter((t) => t.id !== selectedText),
    }));
    setSelectedText(null);
  };

  const resetLayout = () => {
    if (!confirm("Reset the remote layout? Custom positions, sizes, colors and text boxes will be cleared."))
      return;
    persistLayout({ buttons: {}, texts: [] });
    setLayout({ buttons: {}, texts: [] });
    setSelectedRef(null);
    setSelectedText(null);
  };

  const hiddenCount = Object.values(layout.buttons).filter((b) => b.hidden).length;

  /* ---------- render ---------- */
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 px-4 py-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Universal Remote
          </div>
          <div className="hidden h-4 w-px bg-zinc-800 sm:block" />
          <div className="hidden text-xs text-zinc-500 sm:block">
            {items.length} buttons · {layout.texts.length} labels
            {hiddenCount > 0 && ` · ${hiddenCount} hidden`}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editing && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddIrOpen(true)}
                className="gap-1.5 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" /> IR
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddRfOpen(true)}
                className="gap-1.5 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" /> RF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={addTextBox}
                className="gap-1.5 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              >
                <Type className="h-3.5 w-3.5" /> Text
              </Button>
              {hiddenCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={showAll}
                  className="gap-1.5 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                >
                  <Eye className="h-3.5 w-3.5" /> Show {hiddenCount}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-zinc-100">
                    More
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={resetLayout} className="text-destructive focus:text-destructive">
                    <RotateCcw className="mr-2 h-4 w-4" /> Reset layout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          <Button
            size="sm"
            onClick={() => {
              setEditing((v) => !v);
              setSelectedRef(null);
              setSelectedText(null);
            }}
            className={
              editing
                ? "gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                : "gap-1.5 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
            }
          >
            {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editing ? "Done" : "Edit"}
          </Button>
        </div>
      </div>

      <div className={editing ? "grid gap-4 lg:grid-cols-[1fr_280px]" : "flex justify-center"}>
        {/* Canvas */}
        <div
          className="relative mx-auto w-full overflow-hidden rounded-[2rem] border border-zinc-800 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black p-4 shadow-2xl"
          style={{ maxWidth: COLS * GRID + 32 }}
        >
          {/* Brushed metal highlight */}
          <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/[0.04] to-transparent" />
          <div
            ref={canvasRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerDown={(e) => {
              if (editing && e.target === e.currentTarget) {
                setSelectedRef(null);
                setSelectedText(null);
              }
            }}
            className="relative mx-auto touch-none"
            style={{
              width: COLS * GRID,
              height: usedRows * GRID,
              backgroundImage: editing
                ? "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)"
                : undefined,
              backgroundSize: `${GRID}px ${GRID}px`,
            }}
          >
            {/* Text boxes */}
            {layout.texts.map((t) => {
              const sel = selectedText === t.id;
              return (
                <div
                  key={t.id}
                  onPointerDown={(e) => onPointerDown(e, "text", t.id)}
                  className={`absolute flex select-none items-center px-2 ${
                    editing ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
                  } ${sel ? "rounded-md ring-2 ring-primary/70" : ""}`}
                  style={{
                    left: t.x * GRID,
                    top: t.y * GRID,
                    width: t.w * GRID,
                    height: t.h * GRID,
                    justifyContent:
                      t.align === "center" ? "center" : t.align === "right" ? "flex-end" : "flex-start",
                  }}
                >
                  <span
                    className={`font-medium tracking-wide ${FONT_SIZE_CLASS[t.fontSize]} ${TEXT_COLOR_CLASS[t.color]}`}
                  >
                    {t.text || (editing ? "Label" : "")}
                  </span>
                </div>
              );
            })}

            {/* Buttons */}
            {items.map((it) => {
              const b = layout.buttons[it.ref];
              if (!b || b.hidden) return null;
              const Icon =
                it.kind === "ir" ? irIconFor(it.iconKey) : rfIconFor(it.iconKey);
              const color = COLORS[b.color] ?? COLORS.graphite;
              const px = b.size * GRID - 12;
              const pulsed = pulsedRef === it.ref;
              const isLearned =
                it.kind === "rf" ? (it.signal as RfSignal).learned : true;
              const empty =
                it.kind === "ir"
                  ? !(it.signal as IrSignal).code?.length
                  : !isLearned;
              const sel = selectedRef === it.ref;
              return (
                <div
                  key={it.ref}
                  onPointerDown={(e) => onPointerDown(e, "button", it.ref)}
                  className={`absolute flex flex-col items-center justify-center gap-1 transition-transform ${
                    editing ? "cursor-grab active:cursor-grabbing" : ""
                  }`}
                  style={{
                    left: b.x * GRID + 6,
                    top: b.y * GRID + 6,
                    width: px,
                    height: px,
                  }}
                >
                  <button
                    type="button"
                    disabled={!editing && empty}
                    onClick={(e) => {
                      e.stopPropagation();
                      send(it);
                    }}
                    aria-label={it.label}
                    className={`relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-b ${color.face} text-zinc-50 ring-1 ${color.ring} transition-all ${
                      pulsed ? "scale-95 brightness-150" : "active:scale-95"
                    } ${empty ? "opacity-40" : ""} ${
                      sel && editing ? "outline outline-2 outline-offset-2 outline-primary" : ""
                    }`}
                    style={{
                      boxShadow: pulsed
                        ? color.glow
                        : "inset 0 1px 0 rgba(255,255,255,0.12), 0 6px 14px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.4)",
                    }}
                  >
                    <Icon
                      style={{ width: px * 0.42, height: px * 0.42 }}
                      strokeWidth={1.8}
                    />
                    {empty && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-zinc-950 bg-destructive" />
                    )}
                  </button>
                  <span
                    className="pointer-events-none max-w-full truncate text-center text-[10px] font-medium uppercase tracking-wider text-zinc-400"
                    style={{ width: px }}
                  >
                    {it.label}
                  </span>
                </div>
              );
            })}

            {items.length === 0 && !editing && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-xl border border-dashed border-zinc-800 px-6 py-8 text-center">
                  <p className="text-sm text-zinc-500">
                    No buttons yet — tap <span className="text-zinc-300">Edit</span> to add IR or RF controls.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Inspector */}
        {editing && (
          <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-4 shadow-xl">
            {selectedButton && selectedItem ? (
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    Button
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-zinc-100">
                    {selectedItem.label}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {selectedItem.kind === "ir"
                      ? "IR · clock"
                      : `RF · slot ${(selectedItem.signal as RfSignal).slot}`}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    Size
                  </div>
                  <div className="flex gap-1.5">
                    {([1, 2, 3] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setBtn((b) => ({ ...b, size: s }))}
                        className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                          selectedButton.size === s
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-100"
                        }`}
                      >
                        {s === 1 ? "S" : s === 2 ? "M" : "L"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    Color
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.keys(COLORS) as ColorKey[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setBtn((b) => ({ ...b, color: c }))}
                        aria-label={c}
                        className={`h-8 rounded-md ring-2 transition-all ${
                          selectedButton.color === c
                            ? "ring-primary"
                            : "ring-transparent hover:ring-zinc-600"
                        }`}
                        style={{ background: COLORS[c].swatch }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={hideButton}
                    className="flex-1 gap-1.5 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                  >
                    <EyeOff className="h-3.5 w-3.5" /> Hide
                  </Button>
                </div>
              </div>
            ) : selectedTextBox ? (
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    Text label
                  </div>
                </div>
                <Input
                  value={selectedTextBox.text}
                  onChange={(e) => setTxt((t) => ({ ...t, text: e.target.value }))}
                  placeholder="Label text"
                  className="bg-zinc-900"
                />
                <div>
                  <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    Width ({selectedTextBox.w})
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={COLS}
                    value={selectedTextBox.w}
                    onChange={(e) =>
                      setTxt((t) => ({ ...t, w: Number(e.target.value) }))
                    }
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    Size
                  </div>
                  <div className="flex gap-1.5">
                    {(["sm", "md", "lg", "xl"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setTxt((t) => ({ ...t, fontSize: s }))}
                        className={`flex-1 rounded-md border px-2 py-1.5 text-xs uppercase tracking-wider transition-colors ${
                          selectedTextBox.fontSize === s
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-100"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    Align
                  </div>
                  <div className="flex gap-1.5">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setTxt((t) => ({ ...t, align: a }))}
                        className={`flex-1 rounded-md border px-2 py-1.5 text-xs capitalize transition-colors ${
                          selectedTextBox.align === a
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-100"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    Color
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {(Object.keys(TEXT_COLOR_CLASS) as TextBox["color"][]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setTxt((t) => ({ ...t, color: c }))}
                        className={`flex h-8 items-center justify-center rounded-md border text-xs font-semibold ${TEXT_COLOR_CLASS[c]} ${
                          selectedTextBox.color === c
                            ? "border-primary bg-primary/10"
                            : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                        }`}
                      >
                        A
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={deleteTextBox}
                  className="w-full gap-1.5 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete label
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  Editor
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">
                  Drag any button or label to reposition it on the grid.
                  <br />
                  Tap a button to change its size and color, or hide it from the remote.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-400">
                    <Plus className="mr-1 inline h-3 w-3" /> add IR / RF
                  </span>
                  <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-400">
                    <Type className="mr-1 inline h-3 w-3" /> add text
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setSelectedRef(null);
                setSelectedText(null);
              }}
              className="mt-4 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-[10px] uppercase tracking-[0.15em] text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3 w-3" /> deselect
            </button>
          </div>
        )}
      </div>

      {/* Add / learn dialogs */}
      <AddControlDialog
        open={addRfOpen}
        onOpenChange={setAddRfOpen}
        existing={rfSignals}
        onCreated={(slot, label) => setRfLearn({ slot, label })}
      />
      <LearnModal
        open={rfLearn !== null}
        slot={rfLearn?.slot ?? null}
        label={rfLearn?.label ?? ""}
        onOpenChange={(o) => !o && setRfLearn(null)}
        onLearned={refresh}
      />
      <AddIrDialog
        open={addIrOpen}
        onOpenChange={setAddIrOpen}
        onCreate={(device, label, icon) => setIrLearn({ device, label, icon })}
      />
      <IrLearnModal
        open={irLearn !== null}
        device={irLearn?.device ?? null}
        label={irLearn?.label ?? ""}
        icon={irLearn?.icon ?? "power"}
        onOpenChange={(o) => !o && setIrLearn(null)}
        onLearned={refresh}
      />
    </div>
  );
}
