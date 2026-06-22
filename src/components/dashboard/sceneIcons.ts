import {
  Film,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  Coffee,
  Bed,
  Music,
  Gamepad2,
  Sparkles,
  Power,
  Play,
  type LucideIcon,
} from "lucide-react";
import type { SceneIcon } from "@/lib/supabase";

export const SCENE_ICONS: { key: SceneIcon; label: string; icon: LucideIcon }[] = [
  { key: "film", label: "Movie", icon: Film },
  { key: "moon", label: "Night", icon: Moon },
  { key: "sun", label: "Day", icon: Sun },
  { key: "sunrise", label: "Morning", icon: Sunrise },
  { key: "sunset", label: "Evening", icon: Sunset },
  { key: "coffee", label: "Coffee", icon: Coffee },
  { key: "bed", label: "Sleep", icon: Bed },
  { key: "music", label: "Music", icon: Music },
  { key: "gamepad", label: "Game", icon: Gamepad2 },
  { key: "sparkles", label: "Magic", icon: Sparkles },
  { key: "power", label: "Power", icon: Power },
  { key: "play", label: "Play", icon: Play },
];

export function sceneIconFor(key: string): LucideIcon {
  return SCENE_ICONS.find((i) => i.key === key)?.icon ?? Play;
}
