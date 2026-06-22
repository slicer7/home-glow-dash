import { supabase } from "@/lib/supabase";

/**
 * Cross-device settings sync via the public.app_settings table.
 *
 * Each setting is a (key, jsonb value) row. We mirror to localStorage so
 * the UI has an instant value on first paint, then reconcile from the cloud
 * and subscribe to realtime updates so edits on one device appear on all.
 *
 * Saves are debounced + last-write-wins (updated_at timestamp).
 */

const LS_PREFIX = "cloud_settings:";

export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}

export async function fetchSetting<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) return null;
  return (data?.value ?? null) as T | null;
}

/* Debounced upsert per key. */
const pending = new Map<string, ReturnType<typeof setTimeout>>();

export function saveSetting<T>(key: string, value: T, debounceMs = 350) {
  writeLocal(key, value); // optimistic local cache
  const prev = pending.get(key);
  if (prev) clearTimeout(prev);
  pending.set(
    key,
    setTimeout(async () => {
      pending.delete(key);
      await supabase.from("app_settings").upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    }, debounceMs),
  );
}

/**
 * Subscribe to realtime changes for a specific settings key.
 * Returns an unsubscribe function.
 */
export function subscribeSetting<T>(key: string, cb: (value: T) => void) {
  const ch = supabase
    .channel(`app_settings:${key}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_settings", filter: `key=eq.${key}` },
      (payload) => {
        const next = (payload.new as { value?: T } | null)?.value;
        if (next !== undefined && next !== null) {
          writeLocal(key, next);
          cb(next as T);
        }
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}
