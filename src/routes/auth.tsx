import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode === "signup" ? "signup" : "signin") as "signin" | "signup",
  }),
  head: () => ({ meta: [{ title: "Entrar — Meu Caixa" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("Lucas");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Populando seus dados iniciais...");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na autenticação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Meu Caixa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu consultor financeiro pessoal
          </p>
        </div>

        <Card className="rounded-2xl border p-6 shadow-none">
          <h2 className="text-lg font-semibold">
            {isSignup ? "Criar conta" : "Entrar"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup
              ? "Vamos começar com dados de demonstração do Lucas."
              : "Bem-vindo de volta."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={isSignup ? "new-password" : "current-password"}
              />
            </div>
            <Button type="submit" className="w-full rounded-xl" disabled={loading}>
              {loading ? "..." : isSignup ? "Criar conta" : "Entrar"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {isSignup ? (
              <>
                Já tem conta?{" "}
                <Link to="/auth" search={{ mode: "signin" }} className="text-foreground underline">
                  Entrar
                </Link>
              </>
            ) : (
              <>
                Não tem conta?{" "}
                <Link to="/auth" search={{ mode: "signup" }} className="text-foreground underline">
                  Criar
                </Link>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
