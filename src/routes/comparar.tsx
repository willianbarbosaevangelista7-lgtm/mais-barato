import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { AddToListButton, ProductThumb } from "@/components/ProductCard";
import { useCatalog } from "@/lib/store";
import { brl, fmtDate, pct, priceSummary, pricesFor, sizeLabel, unitPrice } from "@/lib/pricing";

export const Route = createFileRoute("/comparar")({
  validateSearch: (s: Record<string, unknown>): { id?: string | undefined } => ({
    id: typeof s["id"] === "string" ? s["id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Comparar preços — MaisBarato" },
      { name: "description", content: "Veja o menor preço, a diferença em reais e porcentagem entre supermercados." },
      { property: "og:title", content: "Comparar preços — MaisBarato" },
      { property: "og:description", content: "Compare produtos equivalentes por marca, peso e volume." },
    ],
  }),
  component: Comparar,
});

function Comparar() {
  const { id } = Route.useSearch();
  const navigate = useNavigate({ from: "/comparar" });
  const catalog = useCatalog();
  const product = catalog.products.find((p) => p.id === (id ?? catalog.products[0]?.id));

  return (
    <AppShell>
      <PageTitle title="Comparar preços" subtitle="Escolha um produto para ver onde ele está mais barato." />
      <select
        aria-label="Produto"
        className="h-12 w-full rounded-xl border border-input bg-card px-3"
        value={product?.id}
        onChange={(e) => navigate({ search: { id: e.target.value } })}
      >
        {catalog.products.map((p) => (
          <option key={p.id} value={p.id}>{p.name} — {p.brand} {sizeLabel(p)}</option>
        ))}
      </select>
      {product && <Detail productId={product.id} />}
    </AppShell>
  );
}

function Detail({ productId }: { productId: string }) {
  const catalog = useCatalog();
  const p = catalog.products.find((x) => x.id === productId)!;
  const prices = pricesFor(catalog, p.id);
  const s = priceSummary(prices);
  const equivalents = catalog.products
    .filter((x) => x.group === p.group)
    .map((x) => {
      const best = pricesFor(catalog, x.id)[0];
      return { x, best, up: best ? unitPrice(x, best.price) : null };
    })
    .filter((e) => e.best)
    .sort((a, b) => a.up!.value - b.up!.value);

  return (
    <div className="mt-4 space-y-5">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <ProductThumb p={p} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight">{p.name}</h2>
          <p className="text-sm text-muted-foreground">{p.brand} · {sizeLabel(p)} · {p.category}</p>
        </div>
      </div>

      {s ? (
        <>
          <div className="bg-hero rounded-2xl p-5 text-primary-foreground">
            <p className="flex items-center gap-1.5 text-sm opacity-90"><Trophy className="h-4 w-4" /> Menor preço</p>
            <p className="text-3xl font-extrabold">{brl(s.min)}</p>
            <p className="text-sm">{s.cheapest.marketName} · atualizado em {fmtDate(s.cheapest.updatedAt)}</p>
            {prices.length > 1 && (
              <p className="mt-3 rounded-xl bg-card/15 p-3 text-sm">
                Economia de <strong>{brl(s.diff)}</strong> ({pct(s.diffPct)}) em relação ao mais caro.
              </p>
            )}
            <div className="mt-4"><AddToListButton productId={p.id} /></div>
          </div>

          <div>
            <h3 className="mb-2 font-extrabold text-primary-deep">Preço em cada mercado</h3>
            <ul className="space-y-2">
              {prices.map((mp, i) => {
                const d = mp.price - s.min;
                return (
                  <li key={mp.marketId} className={`rounded-xl border p-3 ${i === 0 ? "border-success bg-secondary" : "border-border bg-card"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold">{mp.marketName}</span>
                      <span className="shrink-0 text-lg font-bold">{brl(mp.price)}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap justify-between gap-x-2 text-xs text-muted-foreground">
                      <span>Atualizado em {fmtDate(mp.updatedAt)}{mp.isOffer && ` · oferta demo até ${fmtDate(mp.validUntil!)}`}</span>
                      <span className={i === 0 ? "font-bold text-primary" : ""}>
                        {i === 0 ? "Mais barato" : `+${brl(d)} (+${pct((d / s.min) * 100)})`}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">Sem preços cadastrados para este produto.</p>
      )}

      {equivalents.length > 1 && (
        <div>
          <h3 className="font-extrabold text-primary-deep">Produtos equivalentes</h3>
          <p className="mb-2 text-xs text-muted-foreground">Comparados pelo preço por {equivalents[0]?.up?.unit}, considerando marca e tamanho.</p>
          <ul className="space-y-2">
            {equivalents.map(({ x, best, up }, i) => (
              <li key={x.id}>
                <Link to="/comparar" search={{ id: x.id }} className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${x.id === p.id ? "border-primary" : "border-border"} bg-card`}>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{x.brand} · {sizeLabel(x)}</span>
                    <span className="text-xs text-muted-foreground">{brl(best!.price)} em {best!.marketName}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold">{brl(up!.value)}/{up!.unit}</span>
                    {i === 0 && <span className="text-xs font-bold text-primary">Melhor custo-benefício</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
