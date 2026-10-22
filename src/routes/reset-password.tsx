import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — MaisBarato" },
      { name: "description", content: "Crie uma nova senha para sua conta MaisBarato." },
      { property: "og:title", content: "Nova senha — MaisBarato" },
      { property: "og:description", content: "Recuperação de senha do MaisBarato." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ok, setOk] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setOk(true);
    const { data } = supabase.auth.onAuthStateChange((e) => e === "PASSWORD_RECOVERY" && setOk(true));
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return void toast.error("A senha precisa ter pelo menos 6 caracteres.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return void toast.error("Não foi possível trocar a senha. Peça um novo link.");
    toast.success("Senha alterada!");
    navigate({ to: "/" });
  };

  return (
    <AppShell>
      <PageTitle title="Criar nova senha" />
      <div className="mx-auto max-w-sm rounded-2xl border border-border bg-card p-4 shadow-card">
        {ok ? (
          <form onSubmit={submit} className="space-y-2">
            <input aria-label="Nova senha" type="password" required className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm" placeholder="Nova senha" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button disabled={busy} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Aguarde…" : "Salvar nova senha"}</button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Abra esta página pelo link enviado ao seu e-mail.</p>
        )}
      </div>
    </AppShell>
  );
}
