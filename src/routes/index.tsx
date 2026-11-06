import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search, ListChecks, Store, Info } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PhotoSearch } from "@/components/PhotoSearch";
import { ProductThumb } from "@/components/ProductCard";
import { useCatalog, useList } from "@/lib/store";
import { brl, fmtDate, pricesFor, todayISO } from "@/lib/pricing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MaisBarato — Compare preços de supermercado" },
      { name: "description", content: "Compare preços de produtos de supermercado e economize na sua lista de compras." },
      { property: "og:title", content: "MaisBarato — Compare preços de supermercado" },
      { property: "og:description", content: "Compare preços e economize nas compras do mês." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const catalog = useCatalog();
  const list = useList();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const today = todayISO();
  const offers = catalog.offers.filter((o) => o.validUntil >= today);

  return (
    <AppShell>
      <section className="bg-hero -mx-4 -mt-5 px-5 pb-8 pt-7 text-primary-foreground md:mx-0 md:mt-0 md:rounded-3xl">
        <h1 className="text-3xl font-extrabold leading-tight">Compare antes de comprar.</h1>
        <p className="mt-1 text-sm opacity-90">Veja o preço do mesmo produto em vários mercados e monte uma lista mais barata.</p>
        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/busca", search: { q } });
          }}
        >
          <label className="sr-only" htmlFor="home-q">Buscar produto</label>
          <input
            id="home-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex.: arroz, leite, café…"
            className="h-12 min-w-0 flex-1 rounded-xl bg-card px-4 text-foreground outline-none ring-accent focus:ring-2"
          />
          <button className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground" aria-label="Buscar">
            <Search className="h-5 w-5" />
          </button>
        </form>
        <PhotoSearch onSearch={(query) => { void navigate({ to: "/busca", search: { q: query } }); }} />
      </section>

      <Link to="/lista" className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary"><ListChecks /></span>
        <span className="flex-1">
          <span className="block font-bold">Minha lista de compras</span>
          <span className="text-sm text-muted-foreground">{list.length ? `${list.length} item(ns) na lista` : "Sua lista está vazia"}</span>
        </span>
        <span className="text-sm font-semibold text-primary">Abrir →</span>
      </Link>

      <section className="mt-7">
        <h2 className="text-lg font-extrabold text-primary-deep">Ofertas do dia</h2>
        <p className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" /> Ofertas de demonstração, não são promoções reais.
        </p>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:px-0">
          {offers.map((o) => {
            const p = catalog.products.find((x) => x.id === o.productId);
            const m = catalog.markets.find((x) => x.id === o.marketId);
            const regular = catalog.prices.find((x) => x.productId === o.productId && x.marketId === o.marketId);
            if (!p || !m) return null;
            return (
              <Link key={o.id} to="/comparar" search={{ id: p.id }} className="w-60 shrink-0 snap-start rounded-2xl border border-border bg-card p-4 shadow-card md:w-auto">
                <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold uppercase text-warning-foreground">Demo</span>
                <div className="mt-2 flex gap-3">
                  <ProductThumb p={p} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-bold">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.name}</p>
                  </div>
                </div>
                <p className="mt-2">
                  {regular && <span className="mr-2 text-sm text-muted-foreground line-through">{brl(regular.price)}</span>}
                  <strong className="text-xl text-primary">{brl(o.price)}</strong>
                </p>
                <p className="text-[11px] text-muted-foreground">Válida até {fmtDate(o.validUntil)}</p>
              </Link>
            );
          })}
          {!offers.length && <p className="text-sm text-muted-foreground">Nenhuma oferta ativa.</p>}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="text-lg font-extrabold text-primary-deep">Mercados cadastrados</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Ainda não usamos sua localização. Estes mercados são fictícios e não indicam distância real.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {catalog.markets.map((m) => (
            <Link key={m.id} to="/busca" search={{ market: m.id }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <Store className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.neighborhood} · {catalog.prices.filter((p) => p.marketId === m.id).length} preços</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Exemplo: arroz custa {brl(pricesFor(catalog, "p1")[0]?.price ?? 0)} no mercado mais barato (dados fictícios).
      </p>
    </AppShell>
  );
}
