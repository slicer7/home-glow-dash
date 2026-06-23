import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/dashboard/Header";
import { PcPowerCard } from "@/components/dashboard/PcPowerCard";
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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header connected={connected} />
      <main className="flex flex-1 flex-col">
        <div className="shrink-0 p-5 pb-0 lg:p-8 lg:pb-0">
          <PcPowerCard />
        </div>
        <div className="min-h-0 flex-1 p-5 pt-0 lg:p-8 lg:pt-0">
          <RoomView />
        </div>
      </main>
    </div>
  );
}
