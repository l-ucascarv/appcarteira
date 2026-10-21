import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportMonthPicker({ month, onChange }: { month: Date; onChange: (date: Date) => void }) {
  return <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
    <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => onChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-5 w-5" /></Button>
    <div className="text-center text-base font-semibold capitalize">{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</div>
    <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => onChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-5 w-5" /></Button>
  </div>;
}