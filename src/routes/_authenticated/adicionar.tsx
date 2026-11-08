import { createFileRoute } from "@tanstack/react-router";
import { Lancamentos } from "./lancamentos";

export const Route = createFileRoute("/_authenticated/adicionar")({
  head: () => ({ meta: [{ title: "Adicionar lançamento | Meu Caixa" }] }),
  component: () => <Lancamentos mode="add" />,
});
