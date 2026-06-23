import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/dashboard/Header";
import { RoomView } from "@/components/room/RoomView";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Home — 3D Room" },
      {
        name: "description",
        content: "Control your room in 3D — powered by an ESP32 and Supabase.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel("status")
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <Header connected={connected} />
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <RoomView />
      </main>
    </div>
  );
}
