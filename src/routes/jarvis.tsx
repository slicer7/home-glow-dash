import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/dashboard/Header";
import { ScenesGrid } from "@/components/dashboard/ScenesGrid";

export const Route = createFileRoute("/jarvis")({
  head: () => ({
    meta: [{ title: "Smart Home — JARVIS Scenes" }],
  }),
  component: JarvisPage,
});

function JarvisPage() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel("jarvis_status")
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
          <h1 className="text-xl font-semibold tracking-tight">JARVIS Scenes</h1>
          <p className="text-sm text-muted-foreground">
            Scenes JARVIS can run — each with a description of what it does and when to use it.
          </p>
        </div>
        <ScenesGrid forJarvis />
      </main>
    </div>
  );
}
