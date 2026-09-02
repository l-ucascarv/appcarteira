import { User, UserRound } from "lucide-react";

export type Owner = "ele" | "ela";
export const OWNERS: Owner[] = ["ele", "ela"];
export const ownerLabel = (o: Owner) => (o === "ele" ? "Ele" : "Ela");

export function OwnerIcon({ owner, className = "" }: { owner: string; className?: string }) {
  const isEla = owner === "ela";
  const Icon = isEla ? UserRound : User;
  return (
    <span
      title={ownerLabel(isEla ? "ela" : "ele")}
      aria-label={ownerLabel(isEla ? "ela" : "ele")}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
        isEla ? "bg-cat-diario/15 text-cat-diario" : "bg-primary/15 text-primary"
      } ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

export function OwnerSelect({ value, onChange }: { value: Owner; onChange: (v: Owner) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
      {OWNERS.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`flex items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-medium transition-colors ${
            value === o ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          <OwnerIcon owner={o} className={value === o ? "bg-primary-foreground/20 text-primary-foreground" : ""} />
          {ownerLabel(o)}
        </button>
      ))}
    </div>
  );
}
