import { useEffect, useMemo, useRef, useState } from "react";
import {
  supabase,
  type AccessCredential,
  type AccessLevel,
  type DoorKey,
  type Scene,
} from "@/lib/supabase";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  KeyRound,
  LayoutGrid,
  Lock,
  Plus,
  Trash2,
  Radio,
} from "lucide-react";
import { toast } from "sonner";

const PUBLIC_KEYS = ["A", "B", "C", "D"] as const;
const PRIVATE_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const LOCK_KEY = "*";
const NONE = "__none__";

function levelLabel(l: AccessLevel) {
  return l === "full" ? "Full" : "Guest";
}

export function DoorPanel() {
  const [creds, setCreds] = useState<AccessCredential[]>([]);
  const [keys, setKeys] = useState<DoorKey[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const [c, k, s] = await Promise.all([
      supabase
        .from("access_credentials")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase.from("door_keys").select("*"),
      supabase.from("scenes").select("*").order("created_at", { ascending: true }),
    ]);
    if (c.error) toast.error("Couldn’t load credentials", { description: c.error.message });
    else setCreds((c.data ?? []) as AccessCredential[]);
    if (k.error) toast.error("Couldn’t load buttons", { description: k.error.message });
    else setKeys((k.data ?? []) as DoorKey[]);
    if (s.error) toast.error("Couldn’t load scenes", { description: s.error.message });
    else setScenes((s.data ?? []) as Scene[]);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const ch = supabase
      .channel("door_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "access_credentials" },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "door_keys" },
        () => refresh(),
      )
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

  const sceneName = (id: string | null) =>
    id ? scenes.find((s) => s.id === id)?.name ?? "—" : "—";

  return (
    <div className="space-y-6">
      <TagsSection
        creds={creds.filter((c) => c.type === "tag")}
        scenes={scenes}
        sceneName={sceneName}
        loading={loading}
        onRefresh={refresh}
      />
      <CodesSection
        creds={creds.filter((c) => c.type === "code")}
        scenes={scenes}
        sceneName={sceneName}
        loading={loading}
        onRefresh={refresh}
      />
      <ButtonsSection
        keys={keys}
        scenes={scenes}
        loading={loading}
        onRefresh={refresh}
      />
    </div>
  );
}

/* ───────────────────────── NFC Tags ───────────────────────── */

function TagsSection({
  creds,
  scenes,
  sceneName,
  loading,
  onRefresh,
}: {
  creds: AccessCredential[];
  scenes: Scene[];
  sceneName: (id: string | null) => string;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<AccessLevel>("guest");
  const [sceneId, setSceneId] = useState<string>(NONE);
  const [enrolling, setEnrolling] = useState(false);
  /* tag ids that already existed when enrollment started — a new one appearing
   * means the hub just programmed + stored the tag. */
  const knownIdsRef = useRef<Set<string>>(new Set());

  const closeAndReset = () => {
    setOpen(false);
    setEnrolling(false);
    setName("");
    setLevel("guest");
    setSceneId(NONE);
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    knownIdsRef.current = new Set(creds.map((c) => c.id));
    setEnrolling(true);
    const { error } = await supabase.from("commands").insert({
      target_device: "door_hub",
      command: "enroll_tag",
      params: {
        name: name.trim(),
        level,
        scene_id: sceneId === NONE ? null : sceneId,
      },
    });
    if (error) {
      toast.error("Couldn’t start enrollment", { description: error.message });
      setEnrolling(false);
      return;
    }
    toast.success("Hold the tag to the reader…", {
      description: "The hub will save it automatically.",
    });
  };

  /* While enrolling, poll the table directly (don't rely on realtime) so the
   * dialog closes as soon as the hub creates the new tag row. */
  useEffect(() => {
    if (!enrolling) return;
    let active = true;
    const startedAt = Date.now();
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from("access_credentials")
        .select("id")
        .eq("type", "tag");
      if (!active) return;
      const fresh = ((data ?? []) as { id: string }[]).find(
        (r) => !knownIdsRef.current.has(r.id),
      );
      if (fresh) {
        toast.success("Tag enrolled ✓", { description: "Saved to the door hub." });
        onRefresh();
        closeAndReset();
      } else if (Date.now() - startedAt > 45000) {
        toast.error("No tag detected", {
          description: "Hold the tag to the reader and try again.",
        });
        setEnrolling(false);
      }
    }, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrolling]);

  const toggle = async (c: AccessCredential) => {
    const { error } = await supabase
      .from("access_credentials")
      .update({ enabled: !c.enabled })
      .eq("id", c.id);
    if (error) toast.error("Couldn’t update", { description: error.message });
    else onRefresh();
  };

  const remove = async (c: AccessCredential) => {
    const { error } = await supabase.from("access_credentials").delete().eq("id", c.id);
    if (error) toast.error("Delete failed", { description: error.message });
    else {
      toast.success("Tag removed");
      onRefresh();
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Radio className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">NFC Tags</h2>
            <p className="text-xs text-muted-foreground">
              Tap a tag on the door reader to run a scene.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add tag
        </Button>
      </div>

      {loading ? (
        <Skeleton />
      ) : creds.length === 0 ? (
        <Empty text="No tags enrolled yet." />
      ) : (
        <ul className="space-y-2.5">
          {creds.map((c) => (
            <li
              key={c.id}
              className={`flex items-center gap-4 rounded-xl border border-border bg-secondary/30 px-4 py-3 transition-opacity ${
                c.enabled ? "" : "opacity-55"
              }`}
            >
              <Switch checked={c.enabled} onCheckedChange={() => toggle(c)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-semibold">{c.name}</span>
                  <LevelBadge level={c.level} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {c.scene_id ? `→ ${sceneName(c.scene_id)}` : "No scene — won’t do anything yet"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(c)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-destructive"
                aria-label="Delete tag"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeAndReset())}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add NFC tag</DialogTitle>
            <DialogDescription>
              {enrolling
                ? "Hold the tag to the door reader. The hub will save it."
                : "The hub will listen for a tap and save the tag automatically."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                placeholder="Front-door fob"
                value={name}
                disabled={enrolling}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <LevelSelect value={level} onChange={setLevel} disabled={enrolling} />
            <SceneSelect
              scenes={scenes}
              value={sceneId}
              onChange={setSceneId}
              disabled={enrolling}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAndReset}>
              {enrolling ? "Done" : "Cancel"}
            </Button>
            <Button onClick={submit} disabled={enrolling}>
              {enrolling ? "Waiting for tap…" : "Start enrollment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ───────────────────────── Codes ───────────────────────── */

function CodesSection({
  creds,
  scenes,
  sceneName,
  loading,
  onRefresh,
}: {
  creds: AccessCredential[];
  scenes: Scene[];
  sceneName: (id: string | null) => string;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState<AccessLevel>("guest");
  const [sceneId, setSceneId] = useState<string>(NONE);

  const submit = async () => {
    if (!/^\d{4}$/.test(code)) {
      toast.error("Code must be 4 digits");
      return;
    }
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    const { error } = await supabase.from("access_credentials").insert({
      type: "code",
      secret: code,
      name: name.trim(),
      level,
      scene_id: sceneId === NONE ? null : sceneId,
      enabled: true,
    });
    if (error) {
      toast.error("Add failed", { description: error.message });
      return;
    }
    toast.success("Code added");
    setOpen(false);
    setCode("");
    setName("");
    setLevel("guest");
    setSceneId(NONE);
    onRefresh();
  };

  const toggle = async (c: AccessCredential) => {
    const { error } = await supabase
      .from("access_credentials")
      .update({ enabled: !c.enabled })
      .eq("id", c.id);
    if (error) toast.error("Couldn’t update", { description: error.message });
    else onRefresh();
  };

  const remove = async (c: AccessCredential) => {
    const { error } = await supabase.from("access_credentials").delete().eq("id", c.id);
    if (error) toast.error("Delete failed", { description: error.message });
    else {
      toast.success("Code removed");
      onRefresh();
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Keypad Codes</h2>
            <p className="text-xs text-muted-foreground">
              4-digit PINs that run a scene when entered on the door keypad.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add code
        </Button>
      </div>

      {loading ? (
        <Skeleton />
      ) : creds.length === 0 ? (
        <Empty text="No codes yet." />
      ) : (
        <ul className="space-y-2.5">
          {creds.map((c) => (
            <li
              key={c.id}
              className={`flex items-center gap-4 rounded-xl border border-border bg-secondary/30 px-4 py-3 transition-opacity ${
                c.enabled ? "" : "opacity-55"
              }`}
            >
              <Switch checked={c.enabled} onCheckedChange={() => toggle(c)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-semibold">{c.name}</span>
                  <LevelBadge level={c.level} />
                  <span className="font-mono text-xs text-muted-foreground">
                    {c.secret.replace(/./g, "•")}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {c.scene_id ? `→ ${sceneName(c.scene_id)}` : "No scene — won’t do anything yet"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(c)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-destructive"
                aria-label="Delete code"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add keypad code</DialogTitle>
            <DialogDescription>4 digits. Entered on the door keypad.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code-name">Name</Label>
              <Input
                id="code-name"
                placeholder="Guest PIN"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code-secret">4-digit code</Label>
              <Input
                id="code-secret"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                placeholder="••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="font-mono tracking-[0.5em]"
              />
            </div>
            <LevelSelect value={level} onChange={setLevel} />
            <SceneSelect scenes={scenes} value={sceneId} onChange={setSceneId} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ───────────────────────── Buttons ───────────────────────── */

function ButtonsSection({
  keys,
  scenes,
  loading,
  onRefresh,
}: {
  keys: DoorKey[];
  scenes: Scene[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const keyMap = useMemo(() => {
    const m = new Map<string, string | null>();
    keys.forEach((k) => m.set(k.key, k.scene_id));
    return m;
  }, [keys]);

  const setScene = async (key: string, sceneId: string) => {
    const value = sceneId === NONE ? null : sceneId;
    if (value === null) {
      const { error } = await supabase.from("door_keys").delete().eq("key", key);
      if (error) toast.error("Couldn’t clear", { description: error.message });
      else {
        toast.success(`${key} cleared`);
        onRefresh();
      }
      return;
    }
    const { error } = await supabase
      .from("door_keys")
      .upsert({ key, scene_id: value }, { onConflict: "key" });
    if (error) toast.error("Couldn’t save", { description: error.message });
    else {
      toast.success(`${key} → ${scenes.find((s) => s.id === value)?.name ?? "scene"}`);
      onRefresh();
    }
  };

  const renderGroup = (label: string, icon: React.ReactNode, keysList: readonly string[]) => (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {keysList.map((k) => {
          const sceneId = keyMap.get(k) ?? null;
          return (
            <div
              key={k}
              className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-2.5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-background/60 font-mono text-base font-semibold">
                {k}
              </div>
              <div className="min-w-0 flex-1">
                <SceneSelect
                  scenes={scenes}
                  value={sceneId ?? NONE}
                  onChange={(v) => setScene(k, v)}
                  compact
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <LayoutGrid className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Keypad Buttons</h2>
          <p className="text-xs text-muted-foreground">
            Map each key to a scene. Public keys run without a code; private keys need one.
          </p>
        </div>
      </div>

      {loading ? (
        <Skeleton />
      ) : (
        <div className="space-y-5">
          {renderGroup("Public (A–D)", <LayoutGrid className="h-3.5 w-3.5" />, PUBLIC_KEYS)}
          {renderGroup("Private (0–9)", <KeyRound className="h-3.5 w-3.5" />, PRIVATE_KEYS)}
          {renderGroup("Lock", <Lock className="h-3.5 w-3.5" />, [LOCK_KEY])}
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── shared bits ───────────────────────── */

function LevelBadge({ level }: { level: AccessLevel }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        level === "full"
          ? "bg-primary/15 text-primary"
          : "bg-secondary text-muted-foreground"
      }`}
    >
      {levelLabel(level)}
    </span>
  );
}

function LevelSelect({
  value,
  onChange,
  disabled,
}: {
  value: AccessLevel;
  onChange: (v: AccessLevel) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Level</Label>
      <Select value={value} onValueChange={(v) => onChange(v as AccessLevel)} disabled={disabled}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="full">Full — unlocks the room and runs the scene</SelectItem>
          <SelectItem value="guest">Guest — only runs the scene</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function SceneSelect({
  scenes,
  value,
  onChange,
  disabled,
  compact,
}: {
  scenes: Scene[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const trigger = (
    <SelectTrigger className={compact ? "h-8 text-xs" : undefined}>
      <SelectValue placeholder="No scene" />
    </SelectTrigger>
  );
  return compact ? (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      {trigger}
      <SelectContent>
        <SelectItem value={NONE}>No scene</SelectItem>
        {scenes.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <div className="space-y-1.5">
      <Label>Scene</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        {trigger}
        <SelectContent>
          <SelectItem value={NONE}>No scene</SelectItem>
          {scenes.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl border border-border bg-secondary/40"
        />
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
