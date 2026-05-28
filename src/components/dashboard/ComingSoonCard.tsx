import type { LucideIcon } from "lucide-react";
import { Lock } from "lucide-react";

export function ComingSoonCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 opacity-70">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/60 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <span className="flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <Lock className="h-3 w-3" />
          Coming soon
        </span>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground/80">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
