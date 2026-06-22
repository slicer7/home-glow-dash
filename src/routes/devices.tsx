import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/dashboard/Header";
import { PowerStatesPanel } from "@/components/dashboard/PowerStatesPanel";

export const Route = createFileRoute("/devices")({
  head: () => ({
    meta: [{ title: "Smart Home — Devices" }],
  }),
  component: DevicesPage,
});

function DevicesPage() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel("devices_status")
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header connected={connected} />
      <main className="mx-auto max-w-5xl p-5 lg:p-8">
        <div className="mb-5">
          <h1 className="text-xl font-semibold tracking-tight">Devices</h1>
          <p className="text-sm text-muted-foreground">
            Track on/off state so scenes can set absolute states — never out of sync.
          </p>
        </div>
        <PowerStatesPanel />
      </main>
    </div>
  );
}
