import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  hint,
  accent,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: "primary" | "positive" | "negative" | "muted";
  icon?: ReactNode;
}) {
  const accentClass =
    accent === "primary"
      ? "bg-foreground text-background border-transparent"
      : accent === "positive"
      ? "border-emerald-500/30"
      : accent === "negative"
      ? "border-rose-500/30"
      : "";

  const labelColor = accent === "primary" ? "text-background/70" : "text-muted-foreground";
  const hintColor = accent === "primary" ? "text-background/60" : "text-muted-foreground";

  return (
    <Card className={`rounded-2xl border p-5 shadow-none transition-colors ${accentClass}`}>
      <div className="flex items-start justify-between">
        <div className={`text-xs font-medium uppercase tracking-wide ${labelColor}`}>{label}</div>
        {icon ? <div className="opacity-70">{icon}</div> : null}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className={`mt-1 text-xs ${hintColor}`}>{hint}</div> : null}
    </Card>
  );
}
