import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/dashboard/Header";
import { ScenesGrid } from "@/components/dashboard/ScenesGrid";

export const Route = createFileRoute("/scenes")({
  head: () => ({
    meta: [{ title: "Smart Home — Scenes" }],
  }),
  component: ScenesPage,
});

function ScenesPage() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel("scenes_status")
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
          <h1 className="text-xl font-semibold tracking-tight">Scenes</h1>
          <p className="text-sm text-muted-foreground">
            Custom automations — chain RF and IR commands into one tap.
          </p>
        </div>
        <ScenesGrid />
      </main>
    </div>
  );
}
