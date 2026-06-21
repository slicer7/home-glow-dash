import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/dashboard/Header";
import { AlarmManager } from "@/components/dashboard/AlarmManager";

export const Route = createFileRoute("/alarms")({
  head: () => ({
    meta: [{ title: "Smart Home — Alarms" }],
  }),
  component: AlarmsPage,
});

function AlarmsPage() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel("alarms_status")
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header connected={connected} />
      <main className="mx-auto max-w-2xl p-5 lg:p-8">
        <div className="mb-5">
          <h1 className="text-xl font-semibold tracking-tight">Alarms</h1>
          <p className="text-sm text-muted-foreground">
            Shared with the bedside clock — it rings the buzzer when one fires.
          </p>
        </div>
        <AlarmManager />
      </main>
    </div>
  );
}
