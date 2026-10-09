import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { categories, demoCatalog } from "@/lib/demo-data";
import { catalogStore, useCatalog } from "@/lib/store";
import { brl, fmtDate, sizeLabel, todayISO } from "@/lib/pricing";
import type { Unit } from "@/lib/types";

export const Route = createFileRoute("/supermercados")({
  head: () => ({
    meta: [
      { title: "Área dos supermercados (demo) — MaisBarato" },
      { name: "description", content: "Demonstração de cadastro de produtos, preços e ofertas para supermercados." },
      { property: "og:title", content: "Área dos supermercados — MaisBarato" },
      { property: "og:description", content: "Cadastre produtos, informe preços e crie ofertas com validade." },
    ],
  }),
  component: Supermercados,
});

const field = "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm";
const btn = "h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary-deep";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <h2 className="mb-3 font-extrabold text-primary-deep">{title}</h2>
      {children}
    </section>
  );
}
function L({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold text-muted-foreground">{label}<div className="mt-1">{children}</div></label>;
}

function Supermercados() {
  const catalog = useCatalog();
  const [marketId, setMarketId] = useState("m1");
  const market = catalog.markets.find((m) => m.id === marketId)!;

  const addProduct = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name")).trim();
    const size = Number(f.get("size"));
    const price = Number(String(f.get("price")).replace(",", "."));
    if (!name || !(size > 0) || !(price > 0)) return void toast.error("Preencha nome, tamanho e preço válidos.");
    const id = `c${Date.now()}`;
    catalogStore.set((c) => ({
      ...c,
      products: [...c.products, {
        id, name, brand: String(f.get("brand")).trim() || "Sem marca", category: String(f.get("category")),
        size, unit: f.get("unit") as Unit, emoji: "🛒", group: name.toLowerCase(),
      }],
      prices: [...c.prices, { productId: id, marketId, price, updatedAt: todayISO() }],
    }));
    e.currentTarget.reset();
    toast.success("Produto cadastrado (demonstração)");
  };

  const setPrice = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const productId = String(f.get("product"));
    const price = Number(String(f.get("price")).replace(",", "."));
    if (!(price > 0)) return void toast.error("Informe um preço válido.");
    catalogStore.set((c) => ({
      ...c,
      prices: [...c.prices.filter((p) => !(p.productId === productId && p.marketId === marketId)),
        { productId, marketId, price, updatedAt: todayISO() }],
    }));
    e.currentTarget.reset();
    toast.success("Preço atualizado com a data de hoje");
  };

  const addOffer = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const productId = String(f.get("product"));
    const price = Number(String(f.get("price")).replace(",", "."));
    const validUntil = String(f.get("validUntil"));
    const regular = catalog.prices.find((p) => p.productId === productId && p.marketId === marketId);
    if (!regular) return void toast.error("Cadastre primeiro o preço normal deste produto neste mercado.");
    if (!(price > 0) || price >= regular.price) return void toast.error(`A oferta deve ser menor que ${brl(regular.price)}.`);
    if (!validUntil || validUntil < todayISO()) return void toast.error("Escolha uma validade a partir de hoje.");
    catalogStore.set((c) => ({
      ...c,
      offers: [...c.offers.filter((o) => !(o.productId === productId && o.marketId === marketId)),
        { id: `o${Date.now()}`, productId, marketId, price, validUntil }],
    }));
    e.currentTarget.reset();
    toast.success("Oferta de demonstração criada");
  };

  const myPrices = catalog.prices.filter((p) => p.marketId === marketId);
  const myOffers = catalog.offers.filter((o) => o.marketId === marketId);
  const productOptions = catalog.products.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.brand} {sizeLabel(p)}</option>);

  return (
    <AppShell>
      <PageTitle title="Área dos supermercados" subtitle="Interface de demonstração. Os dados ficam salvos apenas neste navegador; não há integração real com mercados." />
      <L label="Você está gerenciando">
        <select className={field} value={marketId} onChange={(e) => setMarketId(e.target.value)}>
          {catalog.markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </L>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card title="Cadastrar produto">
          <form onSubmit={addProduct} className="space-y-2">
            <L label="Nome"><input name="name" className={field} placeholder="Ex.: Macarrão espaguete" /></L>
            <L label="Marca"><input name="brand" className={field} /></L>
            <L label="Categoria"><select name="category" className={field}>{categories.map((c) => <option key={c}>{c}</option>)}</select></L>
            <div className="grid grid-cols-2 gap-2">
              <L label="Tamanho"><input name="size" type="number" step="any" min="0" className={field} /></L>
              <L label="Unidade"><select name="unit" className={field}>{["kg", "g", "L", "ml", "un"].map((u) => <option key={u}>{u}</option>)}</select></L>
            </div>
            <L label="Preço (R$)"><input name="price" inputMode="decimal" className={field} placeholder="0,00" /></L>
            <button className={btn}>Cadastrar</button>
          </form>
        </Card>
        <Card title="Informar preço">
          <form onSubmit={setPrice} className="space-y-2">
            <L label="Produto"><select name="product" className={field}>{productOptions}</select></L>
            <L label="Novo preço (R$)"><input name="price" inputMode="decimal" className={field} placeholder="0,00" /></L>
            <button className={btn}>Salvar preço</button>
          </form>
        </Card>
        <Card title="Criar oferta">
          <form onSubmit={addOffer} className="space-y-2">
            <L label="Produto"><select name="product" className={field}>{productOptions}</select></L>
            <L label="Preço da oferta (R$)"><input name="price" inputMode="decimal" className={field} placeholder="0,00" /></L>
            <L label="Válida até"><input name="validUntil" type="date" min={todayISO()} className={field} /></L>
            <button className={btn}>Criar oferta</button>
          </form>
        </Card>
      </div>

      <div className="mt-4" />
      <Card title={`Preços de ${market.name}`}>
        <ul className="divide-y divide-border text-sm">
          {myPrices.map((pr) => {
            const p = catalog.products.find((x) => x.id === pr.productId);
            const o = myOffers.find((x) => x.productId === pr.productId);
            return (
              <li key={pr.productId} className="flex justify-between gap-2 py-2">
                <span className="min-w-0 truncate">{p?.name} · {p?.brand}</span>
                <span className="shrink-0 text-right">
                  <strong>{brl(pr.price)}</strong>
                  <span className="block text-[11px] text-muted-foreground">
                    {fmtDate(pr.updatedAt)}{o && ` · oferta ${brl(o.price)} até ${fmtDate(o.validUntil)}`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
      <button
        className="mt-4 text-sm font-semibold text-destructive"
        onClick={() => { catalogStore.set(demoCatalog); toast.success("Dados de demonstração restaurados"); }}
      >
        Restaurar dados de demonstração
      </button>
    </AppShell>
  );
}
