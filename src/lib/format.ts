export const brl = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

export const percent = (n: number) => `${Math.max(0, Math.min(100, n)).toFixed(0)}%`;

export const greet = (name: string) => {
  const h = new Date().getHours();
  if (h < 12) return `Bom dia, ${name}`;
  if (h < 18) return `Boa tarde, ${name}`;
  return `Boa noite, ${name}`;
};

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
export const shortMonth = (d: Date) => MONTHS[d.getMonth()];
