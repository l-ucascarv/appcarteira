import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Indicador numérico. `accent` só sinaliza a natureza do valor:
 * - "positive" / "negative": barra fina colorida na base (entrada / saída)
 * - "primary": card escuro de destaque
 */
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
  const inverted = accent === "primary";
  return (
    <Card className={cn("kpi-card min-w-0 p-4 md:p-5", inverted && "bg-foreground text-background")}>
      <div className="flex items-start justify-between gap-2">
        <div className={cn("min-w-0 text-xs font-semibold", inverted ? "text-background/70" : "text-muted-foreground")}>{label}</div>
        {icon ? <div className="shrink-0 opacity-60">{icon}</div> : null}
      </div>
      <div className="mt-2 break-words text-xl font-bold tracking-tight tabular-nums md:text-2xl">{value}</div>
      {hint ? <div className={cn("mt-1 break-words text-xs", inverted ? "text-background/60" : "text-muted-foreground")}>{hint}</div> : null}
      {accent === "positive" || accent === "negative" ? (
        <div aria-hidden className={cn("mt-3 h-1 rounded-full", accent === "positive" ? "bg-success" : "bg-danger")} />
      ) : null}
    </Card>
  );
}

