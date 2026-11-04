import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/queries";
import { useFamilyOverview, useCreateInvite, inviteLink } from "@/lib/family";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Link2, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil e Família | Meu Caixa" },
      { name: "description", content: "Gerencie seu perfil, os membros da família e os convites de acesso." },
      { property: "og:title", content: "Perfil e Família | Meu Caixa" },
      { property: "og:description", content: "Gerencie seu perfil, os membros da família e os convites de acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Perfil,
});

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success("Link copiado"),
    () => toast.error("Não foi possível copiar"),
  );
}

function Perfil() {
  const { data: profile } = useProfile();
  const { data: overview, isLoading } = useFamilyOverview();
  const createInvite = useCreateInvite();
  const [email, setEmail] = useState("");
  const [myId, setMyId] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      setMyId(data.user?.id ?? "");
    });
  }, []);

  const generate = async () => {
    try {
      const token = await createInvite.mutateAsync();
      copy(inviteLink(token));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar convite");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="border-b border-border pb-3">
        <p className="text-xs text-muted-foreground">Conta</p>
        <h1 className="text-lg font-semibold sm:text-2xl">Perfil e família</h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Meu perfil</h2>
        <div className="rounded-lg border bg-card p-4">
          <p className="break-words text-sm font-medium">{profile?.name ?? "Usuário"}</p>
          <p className="break-words text-xs text-muted-foreground">{email}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Users className="h-4 w-4" /> {overview?.family?.name ?? "Minha família"}
        </h2>
        <p className="text-xs text-muted-foreground">
          Todos os membros veem e editam os mesmos lançamentos, saldos e relatórios. Use o filtro por pessoa nas telas para ver a visão individual.
        </p>
        <ul className="divide-y divide-border rounded-lg border bg-card">
          {isLoading && <li className="p-4 text-sm text-muted-foreground">Carregando membros…</li>}
          {overview?.members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {m.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">
                  {m.name} {m.user_id === myId && <span className="text-xs font-normal text-muted-foreground">(você)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  Desde {new Date(m.joined_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Link2 className="h-4 w-4" /> Convidar membro
        </h2>
        <p className="text-xs text-muted-foreground">
          Gere um link e envie por WhatsApp ou mensagem. Quem receber entra com a conta Google e passa a ver e lançar as finanças da família. O link vale por 7 dias.
        </p>
        <Button onClick={generate} disabled={createInvite.isPending} className="rounded-xl">
          {createInvite.isPending ? "Gerando..." : "Gerar link de convite"}
        </Button>
        {overview?.invites?.length ? (
          <ul className="space-y-2">
            {overview.invites.map((inv) => (
              <li key={inv.token} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3">
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{inviteLink(inv.token)}</p>
                  <p className="text-xs">Válido até {new Date(inv.expires_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => copy(inviteLink(inv.token))}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
