import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Market } from "@/lib/types";

/** Admin only (enforced by database rules): link a user account to a market. */
export function AdminPanel({ markets }: { markets: Market[] }) {
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [p, m] = await Promise.all([
        supabase.from("profiles").select("id,email").order("created_at"),
        supabase.from("market_members").select("user_id,market_id"),
      ]);
      return { profiles: p.data ?? [], members: m.data ?? [] };
    },
  });
  const [userId, setUserId] = useState("");
  const [marketId, setMarketId] = useState("");
  const field = "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm";

  const link = async () => {
    if (!userId || !marketId) return void toast.error("Escolha a conta e o mercado.");
    const r1 = await supabase.from("user_roles").upsert({ user_id: userId, role: "market" }, { onConflict: "user_id,role" });
    const r2 = await supabase.from("market_members").upsert({ user_id: userId, market_id: marketId });
    if (r1.error || r2.error) return void toast.error("Não foi possível ligar a conta ao mercado.");
    toast.success("Conta ligada ao mercado");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const data = users.data;
  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
      <h2 className="mb-1 font-extrabold text-primary-deep">Administração</h2>
      <p className="mb-3 text-xs text-muted-foreground">Ligue a conta de um supermercado ao mercado que ela pode gerenciar.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <select aria-label="Conta" className={field} value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Conta…</option>
          {data?.profiles.map((p) => <option key={p.id} value={p.id}>{p.email}</option>)}
        </select>
        <select aria-label="Mercado da conta" className={field} value={marketId} onChange={(e) => setMarketId(e.target.value)}>
          <option value="">Mercado…</option>
          {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button onClick={link} className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground">Ligar</button>
      </div>
      {!!data?.members.length && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {data.members.map((m) => (
            <li key={m.user_id + m.market_id}>
              {data.profiles.find((p) => p.id === m.user_id)?.email ?? m.user_id} → {markets.find((x) => x.id === m.market_id)?.name ?? m.market_id}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
