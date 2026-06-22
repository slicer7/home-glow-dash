import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/dashboard/Header";
import { IrControlGrid } from "@/components/dashboard/IrControlGrid";
import { RfRemoteGrid } from "@/components/dashboard/RfRemoteGrid";

export const Route = createFileRoute("/remotes")({
  head: () => ({
    meta: [{ title: "Smart Home — Remotes" }],
  }),
  component: RemotesPage,
});

function RemotesPage() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel("remotes_status")
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
          <h1 className="text-xl font-semibold tracking-tight">RF Remotes</h1>
          <p className="text-sm text-muted-foreground">
            433.92 MHz signals learned and transmitted by the hub.
          </p>
        </div>
        <RfRemoteGrid />

        <div className="mb-5 mt-10">
          <h1 className="text-xl font-semibold tracking-tight">IR Remotes</h1>
          <p className="text-sm text-muted-foreground">
            Learned on the hub, transmitted by the bedside clock.
          </p>
        </div>
        <IrControlGrid />
      </main>
    </div>
  );
}
