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
  | "skip-forward"
  | "skip-back"
  | "tv"
  | "speaker"
  | "snowflake"
  | "sun"
  | "fan"
  | "chevron-up"
  | "chevron-down";

export type IrSignal = {
  id: string;
  label: string;
  device: IrDevice;
  icon: IrIcon;
  code: number[];
  created_at: string;
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

