import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode === "signup" ? "signup" : "signin") as "signin" | "signup",
  }),
  head: () => ({
    meta: [
      { title: "Entrar — Meu Caixa" },
      { name: "description", content: "Acesse o Meu Caixa com sua conta Google ou Apple." },
      { property: "og:title", content: "Entrar — Meu Caixa" },
      { property: "og:description", content: "Acesse o Meu Caixa com sua conta Google ou Apple." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);

  const signIn = async (provider: "google" | "apple") => {
    setLoading(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Não foi possível entrar. Tente novamente.");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/", replace: true });
    } catch {
      toast.error("Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight lowercase">meu caixa</h1>
          <p className="mt-1 text-sm text-muted-foreground">Seu consultor financeiro pessoal</p>
        </div>

        <Card className="rounded-2xl border p-6">
          <h2 className="text-lg font-semibold">Entrar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use sua conta Google ou Apple para continuar.
          </p>

          <div className="mt-6 space-y-3">
            <Button
              className="w-full rounded-xl"
              variant="outline"
              disabled={loading !== null}
              onClick={() => signIn("google")}
            >
              {loading === "google" ? "..." : "Continuar com Google"}
            </Button>
            <Button
              className="w-full rounded-xl"
              disabled={loading !== null}
              onClick={() => signIn("apple")}
            >
              {loading === "apple" ? "..." : "Continuar com Apple"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
