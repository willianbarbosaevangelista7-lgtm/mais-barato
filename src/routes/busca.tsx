import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { categorySectors } from "@/lib/categories";
import { useCatalog } from "@/lib/store";
import { pricesFor } from "@/lib/pricing";

type S = { q?: string | undefined; cat?: string | undefined; market?: string | undefined; sort?: string | undefined };

export const Route = createFileRoute("/busca")({
  validateSearch: (s: Record<string, unknown>): S => ({
    q: typeof s["q"] === "string" ? s["q"] : undefined,
    cat: typeof s["cat"] === "string" ? s["cat"] : undefined,
    market: typeof s["market"] === "string" ? s["market"] : undefined,
    sort: typeof s["sort"] === "string" ? s["sort"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Buscar produtos — MaisBarato" },
      { name: "description", content: "Busque produtos e veja preços em diferentes supermercados." },
      { property: "og:title", content: "Buscar produtos — MaisBarato" },
      { property: "og:description", content: "Filtre por mercado e categoria e ordene pelo menor preço." },
    ],
  }),
  component: Busca,
});

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function Busca() {
  const { q = "", cat = "", market = "", sort = "menor" } = Route.useSearch();
  const navigate = useNavigate({ from: "/busca" });
  const catalog = useCatalog();
  const set = (patch: Partial<S>) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const results = catalog.products
    .filter((p) => !q || normalize(`${p.name} ${p.brand} ${p.category}`).includes(normalize(q)))
    .filter((p) => !cat || p.category === cat)
    .map((p) => {
      let prices = pricesFor(catalog, p.id);
      if (market) prices = prices.filter((x) => x.marketId === market);
      return { p, prices };
    })
    .filter((r) => !market || r.prices.length)
    .sort((a, b) =>
      sort === "nome" ? a.p.name.localeCompare(b.p.name) : (a.prices[0]?.price ?? 1e9) - (b.prices[0]?.price ?? 1e9),
    );

  const sel = "h-11 rounded-xl border border-input bg-card px-3 text-sm";
  return (
    <AppShell>
      <PageTitle title="Buscar produtos" subtitle="Preços fictícios de demonstração, com data de atualização." />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
        <input
          aria-label="Buscar por nome do produto"
          value={q}
          onChange={(e) => set({ q: e.target.value || undefined })}
          placeholder="Buscar por nome, marca…"
          className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-3 outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <select aria-label="Categoria" className={sel} value={cat} onChange={(e) => set({ cat: e.target.value || undefined })}>
          <option value="">Todas categorias</option>
          {categorySectors.map((sector) => (
            <optgroup key={sector.name} label={sector.name}>
              {sector.categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          ))}
        </select>
        <select aria-label="Mercado" className={sel} value={market} onChange={(e) => set({ market: e.target.value || undefined })}>
          <option value="">Todos mercados</option>
          {catalog.markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select aria-label="Ordenar" className={`${sel} col-span-2 sm:col-span-1`} value={sort} onChange={(e) => set({ sort: e.target.value })}>
          <option value="menor">Menor preço</option>
          <option value="nome">Nome (A–Z)</option>
        </select>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{results.length} produto(s) encontrado(s)</p>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        {results.map(({ p, prices }) => <ProductCard key={p.id} p={p} prices={prices} />)}
      </div>
      {!results.length && (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
          Nenhum produto encontrado. Tente outro nome ou limpe os filtros.
        </div>
      )}
    </AppShell>
  );
}
