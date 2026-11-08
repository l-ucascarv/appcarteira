import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users } from "lucide-react";

type InviteInfo = { family: string; inviter: string | null; valid: boolean } | null;

export const Route = createFileRoute("/convite")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Convite para a família | Meu Caixa" },
      { name: "description", content: "Aceite o convite para colaborar nas finanças da família." },
      { property: "og:title", content: "Convite para a família | Meu Caixa" },
      { property: "og:description", content: "Aceite o convite para colaborar nas finanças da família." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Convite,
});

function Convite() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  const { data: info, isLoading } = useQuery({
    queryKey: ["invite", token],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("invite_info", { p_token: token });
      if (error) throw error;
      return data as unknown as InviteInfo;
    },
  });

  const accept = async () => {
    setAccepting(true);
    try {
      const { error } = await supabase.rpc("accept_family_invite", { p_token: token });
      if (error) throw error;
      sessionStorage.removeItem("pending_invite");
      toast.success("Você entrou para a família!");
      navigate({ to: "/", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível aceitar o convite");
    } finally {
      setAccepting(false);
    }
  };

  const goToSignIn = () => {
    sessionStorage.setItem("pending_invite", token);
    navigate({ to: "/auth", search: { mode: "signin" } });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary-ink">
          <Users className="h-6 w-6" />
        </span>
        {!token && <p className="text-sm text-muted-foreground">Este link de convite está incompleto.</p>}
        {token && isLoading && <p className="text-sm text-muted-foreground">Verificando convite…</p>}
        {token && !isLoading && !info && (
          <p className="text-sm text-muted-foreground">Convite não encontrado. Peça um novo link para quem convidou você.</p>
        )}
        {token && info && !info.valid && (
          <p className="text-sm text-muted-foreground">Este convite expirou ou foi cancelado. Peça um novo link para quem convidou você.</p>
        )}
        {token && info?.valid && (
          <>
            <div className="space-y-1">
              <h1 className="text-lg font-semibold">Convite para {info.family}</h1>
              <p className="text-sm text-muted-foreground">
                {info.inviter ? `${info.inviter} convidou você` : "Você foi convidado"} para ver e lançar as finanças da família em conjunto.
              </p>
            </div>
            {signedIn === null && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {signedIn === true && (
              <Button className="w-full rounded-xl" onClick={accept} disabled={accepting}>
                {accepting ? "Entrando..." : "Aceitar convite"}
              </Button>
            )}
            {signedIn === false && (
              <Button className="w-full rounded-xl" onClick={goToSignIn}>
                Entrar com Google para aceitar
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

