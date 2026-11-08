import * as React from "react";
import { cn } from "@/lib/utils";

/** Filtro em pílula (Todos, Despesas, Receitas…). Use dentro de <ChipRow>. */
export const Chip = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }
>(({ className, selected = false, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-pressed={selected}
    className={cn(
      "inline-flex h-10 shrink-0 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      selected ? "bg-mobile-selected text-mobile-selected-foreground" : "bg-card text-foreground/80 shadow-[var(--shadow-card)] hover:text-foreground",
      className,
    )}
    {...props}
  />
));
Chip.displayName = "Chip";

/** Linha de chips que rola na horizontal no celular, sem barra de rolagem. */
export function ChipRow({ children, className, label }: { children: React.ReactNode; className?: string; label: string }) {
  return (
    <div role="group" aria-label={label} className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden", className)}>
      {children}
    </div>
  );
}

