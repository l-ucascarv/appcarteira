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
      ? "border-success/30"
      : accent === "negative"
      ? "border-danger/30"
      : "";

  const labelColor = accent === "primary" ? "text-background/70" : "text-muted-foreground";
  const hintColor = accent === "primary" ? "text-background/60" : "text-muted-foreground";

  return (
    <Card className={`kpi-card min-w-0 rounded-xl border p-3 shadow-none transition-colors sm:p-5 ${accentClass}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className={`min-w-0 text-xs font-medium ${labelColor}`}>{label}</div>
        {icon ? <div className="shrink-0 opacity-70">{icon}</div> : null}
      </div>
      <div className="mt-2 break-words text-lg font-semibold tabular-nums sm:mt-3 sm:text-2xl">{value}</div>
      {hint ? <div className={`mt-1 break-words text-xs ${hintColor}`}>{hint}</div> : null}
    </Card>
  );
}
