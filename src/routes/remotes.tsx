import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/dashboard/Header";
import { ScenesGrid } from "@/components/dashboard/ScenesGrid";
import { CustomRemote } from "@/components/remote/CustomRemote";

export const Route = createFileRoute("/remotes")({
  head: () => ({
    meta: [{ title: "Smart Home — Remote" }],
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
      <main className="mx-auto max-w-6xl space-y-8 p-5 lg:p-8">
        <ScenesGrid />

        <div>
          <div className="mb-4">
            <h1 className="text-xl font-semibold tracking-tight">Remote</h1>
            <p className="text-sm text-muted-foreground">
              One customizable remote for every RF and IR signal — drag, resize and recolor in edit mode.
            </p>
          </div>
          <CustomRemote />
        </div>
      </main>
    </div>
  );
}
