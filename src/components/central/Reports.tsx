import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/import";
import { sectorOf } from "@/lib/categories";
import { brl, fmtDate, todayISO } from "@/lib/pricing";
import { SOURCE_LABEL } from "@/lib/catalog-cloud";
import type { Catalog } from "@/lib/types";
import { field, fmtDateTime } from "./ui";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

/** Reports: products registered, prices updated, expired offers and stale prices. Markets see only their own markets. */
export function Reports({ catalog, marketIds }: { catalog: Catalog; marketIds: string[] }) {
  const [days, setDays] = useState(30);
  const name = (id: string) => catalog.markets.find((m) => m.id === id)?.name ?? id;
  const prod = (id: string) => catalog.products.find((p) => p.id === id);
  const history = useQuery({
    queryKey: ["history", "report", days, marketIds.join()],
    queryFn: async () => {
      const { data, error } = await supabase.from("price_history").select("*").in("market_id", marketIds).gte("changed_at", daysAgo(days)).order("changed_at", { ascending: false }).limit(1000);
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const today = todayISO();
  const myPrices = catalog.prices.filter((p) => marketIds.includes(p.marketId));
  const myProductIds = new Set(myPrices.map((p) => p.productId));
  const products = catalog.products.filter((p) => myProductIds.has(p.id) || (marketIds.length === catalog.markets.length));
  const bySector = new Map<string, number>();
  products.forEach((p) => bySector.set(sectorOf(p.category), (bySector.get(sectorOf(p.category)) ?? 0) + 1));
  const expired = catalog.offers.filter((o) => marketIds.includes(o.marketId) && o.validUntil < today);
  const stale = myPrices.filter((p) => p.updatedAt < daysAgo(30).slice(0, 10));
  const st = (s: string) => products.filter((p) => (p.status ?? "approved") === s).length;

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Produtos" value={products.length} />
        <Stat label="Pendentes" value={st("pending")} />
        <Stat label={`Alterações em ${days} dias`} value={history.data?.length ?? 0} />
        <Stat label="Ofertas vencidas" value={expired.length} />
      </div>

      <section>
        <h3 className="mb-1 font-bold">Produtos por setor</h3>
        <ul className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-3">
          {[...bySector].sort((a, b) => b[1] - a[1]).map(([s, n]) => <li key={s} className="rounded-lg bg-secondary px-2 py-1">{s}: <strong>{n}</strong></li>)}
        </ul>
        <button className="mt-2 text-xs font-semibold text-primary underline" onClick={() => downloadCsv("produtos.csv", [
          ["id", "ean", "nome", "marca", "categoria", "status"], ...products.map((p) => [p.id, p.barcode ?? "", p.name, p.brand, p.category, p.status ?? "approved"]),
        ])}>Exportar produtos (CSV)</button>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="font-bold">Preços atualizados</h3>
          <select aria-label="Período" className={`${field} h-9 w-36`} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option>
          </select>
        </div>
        <ul className="max-h-72 divide-y divide-border overflow-auto rounded-xl border border-border text-xs">
          {history.data?.map((h) => (
            <li key={h.id} className="flex justify-between gap-2 p-2">
              <span className="min-w-0"><span className="block truncate font-medium">{prod(h.product_id)?.name ?? h.product_id}</span>
                <span className="text-muted-foreground">{name(h.market_id)} · {fmtDateTime(h.changed_at)} · {SOURCE_LABEL[h.source as keyof typeof SOURCE_LABEL] ?? h.source}</span></span>
              <span className="shrink-0 text-right">{h.old_price != null && <s className="block text-muted-foreground">{brl(Number(h.old_price))}</s>}<strong>{brl(Number(h.new_price))}</strong></span>
            </li>
          ))}
          {!history.data?.length && <li className="p-2 text-muted-foreground">Sem alterações no período.</li>}
        </ul>
        <button className="mt-2 text-xs font-semibold text-primary underline" onClick={() => downloadCsv("precos-atualizados.csv", [
          ["data_hora", "mercado", "produto", "preco_anterior", "preco_novo", "origem"],
          ...(history.data ?? []).map((h) => [h.changed_at, name(h.market_id), prod(h.product_id)?.name ?? h.product_id, h.old_price ?? "", h.new_price, h.source]),
        ])}>Exportar (CSV)</button>
      </section>

      <section>
        <h3 className="mb-1 font-bold">Ofertas vencidas</h3>
        <ul className="divide-y divide-border rounded-xl border border-border text-xs">
          {expired.map((o) => <li key={o.id} className="flex justify-between p-2"><span>{prod(o.productId)?.name} · {name(o.marketId)}</span><span>{brl(o.price)} · venceu {fmtDate(o.validUntil)}</span></li>)}
          {!expired.length && <li className="p-2 text-muted-foreground">Nenhuma oferta vencida.</li>}
        </ul>
      </section>

      <section>
        <h3 className="mb-1 font-bold">Preços sem atualização há mais de 30 dias</h3>
        <ul className="max-h-60 divide-y divide-border overflow-auto rounded-xl border border-border text-xs">
          {stale.map((p) => <li key={p.productId + p.marketId} className="flex justify-between p-2"><span>{prod(p.productId)?.name} · {name(p.marketId)}</span><span>{fmtDate(p.updatedAt)}</span></li>)}
          {!stale.length && <li className="p-2 text-muted-foreground">Todos os preços estão em dia.</li>}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-secondary p-3"><p className="text-2xl font-extrabold text-primary-deep">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>;
}
