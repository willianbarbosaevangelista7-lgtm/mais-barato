import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SOURCE_LABEL } from "@/lib/catalog-cloud";
import { brl } from "@/lib/pricing";
import type { Catalog } from "@/lib/types";
import { fmtDateTime } from "./ui";

/** Public price history of one product (all markets). */
export function PriceHistory({ productId, catalog }: { productId: string; catalog: Catalog }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["history", productId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("price_history").select("*").eq("product_id", productId).order("changed_at", { ascending: false }).limit(50);
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const name = (id: string) => catalog.markets.find((m) => m.id === id)?.name ?? id;
  return (
    <section>
      <button className="text-sm font-semibold text-primary underline" onClick={() => setOpen(!open)}>
        {open ? "Ocultar histórico de preço" : "Ver histórico de preço"}
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-card text-xs">
          {q.data?.map((h) => (
            <li key={h.id} className="flex justify-between gap-2 p-2">
              <span>{name(h.market_id)}<span className="block text-muted-foreground">{fmtDateTime(h.changed_at)} · {SOURCE_LABEL[h.source as keyof typeof SOURCE_LABEL] ?? h.source}</span></span>
              <span className="text-right">{h.old_price != null && <s className="block text-muted-foreground">{brl(Number(h.old_price))}</s>}<strong>{brl(Number(h.new_price))}</strong></span>
            </li>
          ))}
          {q.isLoading && <li className="p-2 text-muted-foreground">Carregando…</li>}
          {q.data && !q.data.length && <li className="p-2 text-muted-foreground">Sem histórico.</li>}
        </ul>
      )}
    </section>
  );
}
