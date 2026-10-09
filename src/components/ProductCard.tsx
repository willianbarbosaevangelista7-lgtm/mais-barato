import { Link } from "@tanstack/react-router";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/types";
import { brl, fmtDate, pct, priceSummary, sizeLabel, type MarketPrice } from "@/lib/pricing";
import { listActions, useList } from "@/lib/store";

export function ProductThumb({ p, size = "md" }: { p: Product; size?: "sm" | "md" }) {
  return (
    <div
      role="img"
      aria-label={`Imagem ilustrativa: ${p.name}`}
      className={`grid shrink-0 place-items-center rounded-xl bg-secondary ${size === "sm" ? "h-12 w-12 text-2xl" : "h-16 w-16 text-4xl"}`}
    >
      {p.emoji}
    </div>
  );
}

export function AddToListButton({ productId, compact }: { productId: string; compact?: boolean }) {
  const list = useList();
  const inList = list.some((i) => i.productId === productId);
  return (
    <button
      onClick={() => {
        listActions.add(productId);
        toast.success(inList ? "Quantidade aumentada na lista" : "Adicionado à lista");
      }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors ${
        inList ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground hover:bg-primary-deep"
      } ${compact ? "h-9 px-3 text-xs" : "h-11 px-4 text-sm"}`}
    >
      {inList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {inList ? "Na lista (+1)" : "Adicionar à lista"}
    </button>
  );
}

export function ProductCard({ p, prices }: { p: Product; prices: MarketPrice[] }) {
  const best = prices[0];
  const s = priceSummary(prices);
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex gap-3">
        <ProductThumb p={p} />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-tight">{p.name}</h3>
          <p className="text-sm text-muted-foreground">
            {p.brand} · {sizeLabel(p)}
          </p>
          {best && (
            <p className="mt-1 text-sm">
              a partir de <strong className="text-lg text-primary">{brl(best.price)}</strong>
            </p>
          )}
          {s && prices.length > 1 && s.diff > 0 && (
            <p className="text-xs font-semibold text-success">
              Economize até {brl(s.diff)} ({pct(s.diffPct)}) escolhendo o mais barato
            </p>
          )}
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {prices.map((mp, i) => (
          <li key={mp.marketId} className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm ${i === 0 ? "bg-secondary" : "bg-muted"}`}>
            <span className="min-w-0">
              <span className="block truncate font-medium">{mp.marketName}</span>
              <span className="text-[11px] text-muted-foreground">
                Atualizado em {fmtDate(mp.updatedAt)}
                {mp.isOffer && " · oferta demo"}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className={`block font-bold ${i === 0 ? "text-primary" : ""}`}>{brl(mp.price)}</span>
              <span className="block text-[11px] text-muted-foreground">
                {i === 0 ? (prices.length > 1 ? "menor preço" : "") : `+${brl(mp.price - best!.price)} (+${pct(((mp.price - best!.price) / best!.price) * 100)})`}
              </span>
            </span>
          </li>
        ))}
        {!prices.length && <li className="text-sm text-muted-foreground">Sem preços cadastrados.</li>}
      </ul>
      <div className="mt-3 flex gap-2">
        <Link
          to="/comparar"
          search={{ id: p.id }}
          className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-border text-xs font-semibold hover:bg-muted"
        >
          Comparar
        </Link>
        <AddToListButton productId={p.id} compact />
      </div>
    </article>
  );
}
