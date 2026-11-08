import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Cor da pílula quando selecionada. Padrão: escura (neutra). */
  tone?: "neutral" | "success" | "danger";
};

const SELECTED: Record<NonNullable<SegmentedOption<string>["tone"]>, string> = {
  neutral: "bg-mobile-selected text-mobile-selected-foreground",
  success: "bg-success text-success-foreground",
  danger: "bg-danger text-danger-foreground",
};

/**
 * Seletor segmentado em pílula (ex.: Entrada | Saída, Minhas finanças | Família).
 * Um único componente para todo "escolha uma entre poucas opções".
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T | null;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-card p-1 shadow-[var(--shadow-card)]", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? SELECTED[option.tone ?? "neutral"] : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

