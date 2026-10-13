import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — MaisBarato" },
      { name: "description", content: "Entre ou crie sua conta no MaisBarato." },
      { property: "og:title", content: "Entrar — MaisBarato" },
      { property: "og:description", content: "Acesso para clientes e supermercados." },
    ],
  }),
  component: AuthPage,
});

const field = "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return void toast.error("A senha precisa ter pelo menos 6 caracteres.");
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/supermercados" });
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (data.session) navigate({ to: "/supermercados" });
        else toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
      }
    } catch (err) {
      const msg = (err as Error).message;
      toast.error(/Invalid login/i.test(msg) ? "E-mail ou senha incorretos." : /confirm/i.test(msg) ? "Confirme seu e-mail antes de entrar." : msg);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Não foi possível entrar com o Google.");
  };

  return (
    <AppShell>
      <PageTitle title={mode === "in" ? "Entrar" : "Criar conta"} subtitle="A busca e a lista funcionam sem login. A conta é necessária para supermercados." />
      <div className="mx-auto max-w-sm rounded-2xl border border-border bg-card p-4 shadow-card">
        <button onClick={google} className="h-11 w-full rounded-xl border border-border font-semibold hover:bg-muted">Continuar com Google</button>
        <p className="my-3 text-center text-xs text-muted-foreground">ou com e-mail</p>
        <form onSubmit={submit} className="space-y-2">
          <input aria-label="E-mail" type="email" required className={field} placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input aria-label="Senha" type="password" required className={field} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button disabled={busy} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary-deep disabled:opacity-60">
            {busy ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}
          </button>
        </form>
        <button className="mt-3 w-full text-sm font-semibold text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
      </div>
    </AppShell>
  );
}
