import {
  Power,
  Volume2,
  Volume1,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Tv,
  Speaker,
  Snowflake,
  Sun,
  Fan,
  ChevronUp,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import type { IrDevice, IrIcon } from "@/lib/supabase";

export const IR_ICONS: { key: IrIcon; label: string; icon: LucideIcon }[] = [
  { key: "power", label: "Power", icon: Power },
  { key: "volume-up", label: "Vol +", icon: Volume2 },
  { key: "volume-down", label: "Vol −", icon: Volume1 },
  { key: "volume-x", label: "Mute", icon: VolumeX },
  { key: "chevron-up", label: "Up", icon: ChevronUp },
  { key: "chevron-down", label: "Down", icon: ChevronDown },
  { key: "play", label: "Play", icon: Play },
  { key: "pause", label: "Pause", icon: Pause },
  { key: "skip-forward", label: "Next", icon: SkipForward },
  { key: "skip-back", label: "Prev", icon: SkipBack },
  { key: "tv", label: "TV", icon: Tv },
  { key: "speaker", label: "Speaker", icon: Speaker },
  { key: "snowflake", label: "Cool", icon: Snowflake },
  { key: "sun", label: "Heat", icon: Sun },
  { key: "fan", label: "Fan", icon: Fan },
];

export function irIconFor(key: string): LucideIcon {
  return IR_ICONS.find((i) => i.key === key)?.icon ?? Power;
}

export const IR_DEVICES: { key: IrDevice; label: string; icon: LucideIcon }[] = [
  { key: "tv", label: "TV", icon: Tv },
  { key: "speaker", label: "Speaker", icon: Speaker },
  { key: "ac", label: "Air Conditioner", icon: Snowflake },
];

export function deviceMeta(key: string) {
  return IR_DEVICES.find((d) => d.key === key) ?? IR_DEVICES[0];
}
