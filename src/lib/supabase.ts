import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nmkfiygbqeslzziccghq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ta2ZpeWdicWVzbHp6aWNjZ2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MjYzMDEsImV4cCI6MjA5NTUwMjMwMX0.uQ1Xbg4IF3bs5co73d6FCcXKJ3qoihUvO7Iyoy3GIw4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 20 } },
});

export type DeviceEvent = {
  id: string;
  device_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export type RfIcon = "lightbulb" | "fan" | "power" | "plug" | "sun" | "snowflake";

export type RfSignal = {
  slot: number;
  label: string;
  icon: RfIcon;
  learned: boolean;
  created_at: string;
  pos_x: number | null;
  pos_y: number | null;
  pos_z: number | null;
};

/* ── IR (TV / speaker / AC) — learned by the P4, transmitted by the clock ── */

export type IrDevice = "tv" | "speaker" | "ac";

export type IrIcon =
  | "power"
  | "volume-up"
  | "volume-down"
  | "volume-x"
  | "play"
  | "pause"
  | "stop"
  | "record"
  | "rewind"
  | "fast-forward"
  | "skip-forward"
  | "skip-back"
  | "tv"
  | "speaker"
  | "snowflake"
  | "sun"
  | "moon"
  | "fan"
  | "wind"
  | "thermometer"
  | "droplet"
  | "chevron-up"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "channel-up"
  | "channel-down"
  | "input"
  | "menu"
  | "home"
  | "back"
  | "info"
  | "guide"
  | "settings"
  | "mic"
  | "lightbulb"
  | "zap"
  | "hash";


export type IrSignal = {
  id: string;
  label: string;
  device: IrDevice;
  icon: IrIcon;
  code: number[];
  created_at: string;
  pos_x: number | null;
  pos_y: number | null;
  pos_z: number | null;
};

/* ── Alarms — shared by the clock and the website ── */

export type Alarm = {
  id: string;
  hour: number; // 0..23
  minute: number; // 0..59
  enabled: boolean;
  label: string;
  created_at: string;
};

/* ── Scenes — sequential macros of RF/IR sends with delays ── */

export type SceneStep =
  | { kind: "rf"; slot: number; label: string }
  | { kind: "ir"; signal_id: string; label: string }
  | { kind: "delay"; ms: number }
  | { kind: "power"; ref: string; name: string; desired: boolean };

/* ── Power states — tracked on/off state for devices ── */

export type PowerState = {
  ref: string; // "ir:<id>" or "rf:<slot>"
  name: string;
  is_on: boolean;
  updated_at: string;
};

export function powerRefFromIr(signalId: string): string {
  return `ir:${signalId}`;
}
export function powerRefFromRf(slot: number): string {
  return `rf:${slot}`;
}

/** Route an IR send to the right emitter: AC lives by the door hub, everything else on the clock. */
export function irTarget(device: IrDevice): "door_hub" | "clock" {
  return device === "ac" ? "door_hub" : "clock";
}

export async function sendPowerToggle(ref: string) {
  if (ref.startsWith("rf:")) {
    const slot = Number(ref.slice(3));
    return supabase.from("commands").insert({
      target_device: "p4_hub",
      command: "rf_send",
      params: { slot },
    });
  }
  if (ref.startsWith("pc:")) {
    return supabase.from("commands").insert({
      target_device: "pc_power",
      command: "press",
    });
  }
  const signal_id = ref.slice(3);
  const { data } = await supabase
    .from("ir_signals")
    .select("device")
    .eq("id", signal_id)
    .maybeSingle();
  const device = ((data as { device: IrDevice } | null)?.device ?? "tv") as IrDevice;
  return supabase.from("commands").insert({
    target_device: irTarget(device),
    command: "ir_send",
    params: { signal_id },
  });
}

/* ── Door — NFC tags, keypad codes, and keypad scene buttons ── */

export type AccessLevel = "full" | "guest";
export type AccessType = "tag" | "code";

export type AccessCredential = {
  id: string;
  type: AccessType;
  secret: string;
  name: string;
  level: AccessLevel;
  scene_id: string | null;
  enabled: boolean;
  created_at: string;
};

export type DoorKey = {
  key: string;
  scene_id: string | null;
};

export type SceneIcon =
  | "film"
  | "moon"
  | "sun"
  | "sunrise"
  | "sunset"
  | "coffee"
  | "bed"
  | "music"
  | "gamepad"
  | "sparkles"
  | "power"
  | "play";

export type Scene = {
  id: string;
  name: string;
  icon: SceneIcon;
  steps: SceneStep[];
  created_at: string;
};


