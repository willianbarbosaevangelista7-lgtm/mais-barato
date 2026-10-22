import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { ProductThumb } from "@/components/ProductCard";
import { listActions, useCatalog, useList } from "@/lib/store";
import { analyzeList, brl, sizeLabel } from "@/lib/pricing";

export const Route = createFileRoute("/lista")({
  head: () => ({
    meta: [
      { title: "Lista de compras — MaisBarato" },
      { name: "description", content: "Sua lista de compras com total estimado e economia potencial." },
      { property: "og:title", content: "Lista de compras — MaisBarato" },
      { property: "og:description", content: "Descubra se compensa comprar tudo em um mercado ou dividir a compra." },
    ],
  }),
  component: Lista,
});

function Lista() {
  const catalog = useCatalog();
  const list = useList();
  const a = analyzeList(catalog, list);

  if (!list.length)
    return (
      <AppShell>
        <PageTitle title="Lista de compras" />
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-4xl">🛒</p>
          <p className="mt-2 font-semibold">Sua lista está vazia</p>
          <p className="text-sm text-muted-foreground">Busque produtos e toque em “Adicionar à lista”.</p>
          <Link to="/busca" className="mt-4 inline-flex h-11 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground">Buscar produtos</Link>
        </div>
      </AppShell>
    );

  const splitBetter = a.bestSingle ? a.bestSingle.total - a.splitTotal : 0;

  return (
    <AppShell>
      <PageTitle title="Lista de compras" subtitle="Salva neste navegador e, se você entrar, na sua conta. Valores com base em preços fictícios." />
      <div className="grid gap-5 md:grid-cols-[1fr_320px]">
        <ul className="space-y-2">
          {a.rows.map(({ item, product: p, best }) => (
            <li key={p.id} className={`rounded-2xl border border-border bg-card p-3 ${item.bought ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={item.bought}
                  onChange={() => listActions.toggle(p.id)}
                  aria-label={`Marcar ${p.name} como comprado`}
                  className="mt-4 h-5 w-5 shrink-0 accent-[var(--primary)]"
                />
                <ProductThumb p={p} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold leading-tight ${item.bought ? "line-through" : ""}`}>{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.brand} · {sizeLabel(p)}</p>
                  {best ? (
                    <p className="mt-1 text-xs">Mais barato: <strong>{best.marketName}</strong> · {brl(best.price)}</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Sem preço</p>
                  )}
                </div>
                <button onClick={() => listActions.remove(p.id)} aria-label={`Remover ${p.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-destructive hover:bg-muted">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between pl-8">
                <div className="flex items-center rounded-lg border border-border">
                  <button aria-label="Diminuir" onClick={() => listActions.setQty(p.id, item.qty - 1)} className="grid h-8 w-8 place-items-center"><Minus className="h-4 w-4" /></button>
                  <span className="w-8 text-center text-sm font-bold" aria-label="Quantidade">{item.qty}</span>
                  <button aria-label="Aumentar" onClick={() => listActions.setQty(p.id, item.qty + 1)} className="grid h-8 w-8 place-items-center"><Plus className="h-4 w-4" /></button>
                </div>
                <span className="font-bold">{brl((best?.price ?? 0) * item.qty)}</span>
              </div>
            </li>
          ))}
          <button onClick={listActions.clear} className="text-sm font-semibold text-destructive">Limpar lista</button>
        </ul>

        <aside className="space-y-3">
          <div className="bg-hero rounded-2xl p-5 text-primary-foreground">
            <p className="text-sm opacity-90">Total estimado (melhor preço de cada item)</p>
            <p className="text-3xl font-extrabold" data-testid="total">{brl(a.splitTotal)}</p>
            <p className="mt-2 text-sm">Economia potencial: <strong>{brl(a.potentialSavings)}</strong></p>
            <p className="text-xs opacity-80">comparado a pagar o preço mais alto de cada item ({brl(a.worstTotal)}). Considera {a.comparedItems} item(ns) vendido(s) em mais de um mercado, sempre o mesmo produto e tamanho.</p>
            {a.unpriced > 0 && <p className="mt-1 text-xs opacity-80">{a.unpriced} item(ns) sem preço não entram no total.</p>}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-extrabold text-primary-deep">Um mercado ou vários?</h2>
            <p className="mt-2 flex justify-between text-sm"><span>Dividindo entre mercados</span><strong>{brl(a.splitTotal)}</strong></p>
            {a.bestSingle ? (
              <p className="flex justify-between text-sm"><span>Tudo em {a.bestSingle.name}</span><strong>{brl(a.bestSingle.total)}</strong></p>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum mercado tem todos os itens da lista.</p>
            )}
            {a.bestSingle && (
              <p className="mt-2 rounded-lg bg-secondary p-2 text-sm text-secondary-foreground">
                {splitBetter > 0.004
                  ? `Dividir a compra economiza ${brl(splitBetter)}.`
                  : "Comprar tudo em um só mercado sai pelo mesmo preço."}
              </p>
            )}
            <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
              {a.markets.map((m) => (
                <li key={m.marketId} className="flex justify-between gap-2">
                  <span className="truncate">{m.name}</span>
                  <span className="shrink-0">{m.missing ? `${brl(m.total)} · faltam ${m.missing}` : brl(m.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
