import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase, type DeviceEvent } from "@/lib/supabase";
import { Header } from "@/components/dashboard/Header";
import { EventFeed } from "@/components/dashboard/EventFeed";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [{ title: "Smart Home — Activity" }],
  }),
  component: EventsPage,
});

function EventsPage() {
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let active = true;

    supabase
      .from("device_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (active && data) setEvents(data as DeviceEvent[]);
      });

    const channel = supabase
      .channel("device_events_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "device_events" },
        (payload) => {
          setEvents((prev) => [payload.new as DeviceEvent, ...prev].slice(0, 50));
        },
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header connected={connected} />
      <main className="mx-auto max-w-3xl p-5 lg:p-8">
        <div className="h-[calc(100vh-9rem)]">
          <EventFeed events={events} />
        </div>
      </main>
    </div>
  );
}
