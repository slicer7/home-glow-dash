import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lightbulb, Fan, Thermometer, Radio, Plug } from "lucide-react";
import { supabase, type DeviceEvent } from "@/lib/supabase";
import { Header } from "@/components/dashboard/Header";
import { ButtonStateCard } from "@/components/dashboard/ButtonStateCard";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { ComingSoonCard } from "@/components/dashboard/ComingSoonCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Home — ESP32 Dashboard" },
      {
        name: "description",
        content:
          "Realtime control panel for a DIY ESP32 smart home, powered by Supabase.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastPressedAt, setLastPressedAt] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;

    // initial fetch
    supabase
      .from("device_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!active || !data) return;
        const rows = data as DeviceEvent[];
        setEvents(rows);
        const lastBtn = rows.find(
          (e) => e.device_id === "p4_hub" && e.event_type === "button_press",
        );
        if (lastBtn) setLastPressedAt(new Date(lastBtn.created_at));
      });

    const channel = supabase
      .channel("device_events_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "device_events" },
        (payload) => {
          const evt = payload.new as DeviceEvent;
          setEvents((prev) => [evt, ...prev].slice(0, 20));
          if (
            evt.device_id === "p4_hub" &&
            evt.event_type === "button_press"
          ) {
            setLastPressedAt(new Date(evt.created_at));
          }
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header connected={connected} />
      <main className="mx-auto grid max-w-7xl gap-5 p-5 lg:grid-cols-3 lg:p-8">
        <section className="space-y-5 lg:col-span-2">
          <ButtonStateCard lastPressedAt={lastPressedAt} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ComingSoonCard
              title="Lights"
              description="Toggle and dim individual fixtures."
              icon={Lightbulb}
            />
            <ComingSoonCard
              title="Fan"
              description="On/off plus speed control."
              icon={Fan}
            />
            <ComingSoonCard
              title="Climate"
              description="Temperature & humidity readout."
              icon={Thermometer}
            />
            <ComingSoonCard
              title="RFID scenes"
              description="Trigger log from RFID taps."
              icon={Radio}
            />
            <ComingSoonCard
              title="Smart plugs"
              description="Toggle outlets and monitor draw."
              icon={Plug}
            />
          </div>
        </section>
        <aside className="lg:col-span-1">
          <div className="h-[600px] lg:sticky lg:top-5 lg:h-[calc(100vh-7rem)]">
            <EventFeed events={events} />
          </div>
        </aside>
      </main>
    </div>
  );
}
