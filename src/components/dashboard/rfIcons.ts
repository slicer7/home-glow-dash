import { Lightbulb, Fan, Power, Plug, Sun, Snowflake, type LucideIcon } from "lucide-react";
import type { RfIcon } from "@/lib/supabase";

export const RF_ICONS: { key: RfIcon; label: string; icon: LucideIcon }[] = [
  { key: "lightbulb", label: "Light", icon: Lightbulb },
  { key: "fan", label: "Fan", icon: Fan },
  { key: "power", label: "Power", icon: Power },
  { key: "plug", label: "Plug", icon: Plug },
  { key: "sun", label: "Sun", icon: Sun },
  { key: "snowflake", label: "Cool", icon: Snowflake },
];

export function iconFor(key: string): LucideIcon {
  return RF_ICONS.find((i) => i.key === key)?.icon ?? Power;
}
