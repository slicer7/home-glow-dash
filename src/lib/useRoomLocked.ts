import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type RoomState = {
  id: number;
  locked: boolean;
  screen_code: string | null;
  updated_at: string;
};

/** Subscribe to the single-row room_state table (id=1). */
export function useRoomState() {
  const [state, setState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from("room_state")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (!alive) return;
      setState((data as RoomState | null) ?? null);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("room_state_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_state" },
        () => load(),
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, []);

  return { state, locked: state?.locked ?? false, loading };
}
