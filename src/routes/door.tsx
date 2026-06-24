import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/dashboard/Header";
import { DoorPanel } from "@/components/dashboard/DoorPanel";

export const Route = createFileRoute("/door")({
  head: () => ({
    meta: [{ title: "Smart Home — Door" }],
  }),
  component: DoorPage,
});

function DoorPage() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel("door_status")
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
          <h1 className="text-xl font-semibold tracking-tight">Door</h1>
          <p className="text-sm text-muted-foreground">
            NFC tags, keypad codes, and quick-action buttons on the door hub.
          </p>
        </div>
        <DoorPanel />
      </main>
    </div>
  );
}
