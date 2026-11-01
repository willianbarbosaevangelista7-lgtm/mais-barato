import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Pencil, ScanBarcode } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { PhotoPicker, type PhotoState } from "@/components/PhotoPicker";
import { AdminPanel } from "@/components/AdminPanel";
import { useAccess } from "@/lib/auth";
import { barcodeError } from "@/lib/barcode";
import { AppShell, PageTitle } from "@/components/AppShell";
import { categories } from "@/lib/demo-data";
import { useCatalog } from "@/lib/store";
import { catalogRepo, groupKey, newId } from "@/lib/repository";
import { brl, fmtDate, parseMoney, sizeLabel, todayISO } from "@/lib/pricing";
import type { Unit } from "@/lib/types";

export const Route = createFileRoute("/supermercados")({
  head: () => ({
    meta: [
      { title: "Área dos supermercados (demo) — MaisBarato" },
      { name: "description", content: "Cadastre e edite supermercados, produtos, preços e ofertas (dados de demonstração)." },
      { property: "og:title", content: "Área dos supermercados — MaisBarato" },
      { property: "og:description", content: "Cadastre mercados, produtos, preços com data de atualização e ofertas com validade." },
    ],
  }),
  component: Supermercados,
});

const field = "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm";
const btn = "h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary-deep";
const btn2 = "h-11 w-full rounded-xl border border-border font-semibold hover:bg-muted";
const UNITS: Unit[] = ["kg", "g", "L", "ml", "un"];

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

type MarketForm = { id?: string | undefined; name: string; neighborhood: string; address: string };
type ItemForm = {
  productId?: string | undefined;
  name: string; brand: string; category: string; size: string; unit: Unit;
  price: string; updatedAt: string; hasOffer: boolean; offerPrice: string; validUntil: string;
  barcode: string; photo: PhotoState;
};
const emptyItem = (): ItemForm => ({
  name: "", brand: "", category: categories[0]!, size: "", unit: "kg",
  price: "", updatedAt: todayISO(), hasOffer: false, offerPrice: "", validUntil: "",
  barcode: "", photo: {},
});
const money = (v: number) => v.toFixed(2).replace(".", ",");

function Supermercados() {
  const all = useCatalog();
  const access = useAccess();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["catalog"] });
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);
  const myMarkets = access.isAdmin ? all.markets : all.markets.filter((m) => access.marketIds.includes(m.id));
  const catalog = { ...all, markets: myMarkets };
  const [marketId, setMarketId] = useState("");
  const market = catalog.markets.find((m) => m.id === marketId) ?? catalog.markets[0];
  const [mf, setMf] = useState<MarketForm | null>(null);
  const [it, setIt] = useState<ItemForm>(emptyItem);

  const saveMarket = async (e: FormEvent) => {
    e.preventDefault();
    if (!mf) return;
    const name = mf.name.trim();
    const neighborhood = mf.neighborhood.trim();
    if (name.length < 2) return void toast.error("Informe o nome do supermercado.");
    if (!neighborhood) return void toast.error("Informe o bairro.");
    const id = mf.id ?? newId("m");
    setBusy(true);
    try {
      await catalogRepo.saveMarket({ id, name, neighborhood, address: mf.address.trim() }, !mf.id);
      await refresh();
      setMarketId(id);
      setMf(null);
      toast.success(mf.id ? "Supermercado atualizado" : "Supermercado cadastrado");
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  const editItem = (productId: string) => {
    const p = catalog.products.find((x) => x.id === productId);
    const pr = catalog.prices.find((x) => x.productId === productId && x.marketId === market?.id);
    const o = catalog.offers.find((x) => x.productId === productId && x.marketId === market?.id);
    if (!p) return;
    setIt({
      productId, name: p.name, brand: p.brand, category: p.category, size: String(p.size), unit: p.unit,
      price: pr ? money(pr.price) : "", updatedAt: pr?.updatedAt ?? todayISO(),
      hasOffer: !!o, offerPrice: o ? money(o.price) : "", validUntil: o?.validUntil ?? "",
      barcode: p.barcode ?? "", photo: { path: p.imagePath },
    });
    document.getElementById("form-produto")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const saveItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!market) return void toast.error("Cadastre um supermercado primeiro.");
    const name = it.name.trim();
    const size = Number(it.size.replace(",", "."));
    const price = parseMoney(it.price);
    if (name.length < 2) return void toast.error("Informe o nome do produto.");
    if (!(size > 0)) return void toast.error("Informe um peso ou volume válido.");
    if (!(price > 0)) return void toast.error("Informe um preço válido.");
    if (!it.updatedAt || it.updatedAt > todayISO()) return void toast.error("A data de atualização não pode ser futura.");
    let offerPrice = 0;
    if (it.hasOffer) {
      offerPrice = parseMoney(it.offerPrice);
      if (!(offerPrice > 0) || offerPrice >= price) return void toast.error(`O preço da oferta deve ser menor que ${brl(price)}.`);
      if (!it.validUntil || it.validUntil < todayISO()) return void toast.error("A validade da oferta deve ser hoje ou depois.");
    }
    const barcode = it.barcode.trim();
    const bErr = barcodeError(barcode);
    if (bErr) return void toast.error(bErr);
    const dup = barcode ? all.products.find((p) => p.barcode === barcode && p.id !== it.productId) : undefined;
    if (dup) return void toast.error(`Este código já pertence a "${dup.name} (${dup.brand})". Use o botão "Usar este produto".`);
    const brand = it.brand.trim() || "Sem marca";
    // Same name + brand + size + unit = same product (prices are attached to it per market).
    const existing = it.productId
      ? catalog.products.find((p) => p.id === it.productId)
      : all.products.find((p) => !p.barcode && groupKey(p.name) === groupKey(name) && groupKey(p.brand) === groupKey(brand) && p.size === size && p.unit === it.unit);
    const productId = existing?.id ?? newId("p");
    setBusy(true);
    let uploaded: string | undefined;
    try {
      const old = existing?.imagePath;
      let imagePath = it.photo.removed ? undefined : old;
      if (it.photo.pending) imagePath = uploaded = await catalogRepo.uploadImage(productId, it.photo.pending);
      await catalogRepo.saveItem({
        product: {
          id: productId, name, brand, category: it.category, size, unit: it.unit,
          emoji: existing?.emoji ?? "🛒", group: existing?.group ?? groupKey(name),
          barcode: barcode || undefined, imagePath,
        },
        marketId: market.id, price, updatedAt: it.updatedAt,
        offer: it.hasOffer ? { id: newId("o"), price: offerPrice, validUntil: it.validUntil } : null,
      });
      if (old && old !== imagePath) void catalogRepo.removeImage(old);
      await refresh();
      toast.success(it.productId || existing ? "Produto e preço atualizados" : "Produto cadastrado");
      setIt(emptyItem());
    } catch (err) {
      if (uploaded) void catalogRepo.removeImage(uploaded);
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  const set = (patch: Partial<ItemForm>) => setIt((s) => ({ ...s, ...patch }));
  const myPrices = market ? catalog.prices.filter((p) => p.marketId === market.id) : [];
  // Shared product fields (name, brand, photo) are editable only by markets that sell the product
  // (or admins). The database enforces this; the UI only reflects it.
  const canEditShared =
    !it.productId || access.isAdmin ||
    all.prices.some((pr) => pr.productId === it.productId && access.marketIds.includes(pr.marketId));

  const dupBarcode = it.barcode.length >= 8 ? all.products.find((p) => p.barcode === it.barcode && p.id !== it.productId) : undefined;
  const title = <PageTitle title="Área dos supermercados" subtitle="Os dados ficam no banco compartilhado e aparecem para todos. Não há integração automática com mercados." />;

  if (!access.ready) return <AppShell>{title}<p className="text-sm text-muted-foreground">Verificando acesso…</p></AppShell>;
  if (!access.user)
    return (
      <AppShell>{title}
        <Card title="Acesso de supermercados">
          <p className="mb-3 text-sm text-muted-foreground">Entre na sua conta para cadastrar produtos, preços e ofertas do seu mercado.</p>
          <Link to="/auth" className={`${btn} grid place-items-center`}>Entrar</Link>
        </Card>
      </AppShell>
    );
  if (!access.isAdmin && !myMarkets.length)
    return (
      <AppShell>{title}
        <Card title="Conta ainda não ligada a um mercado">
          <p className="text-sm text-muted-foreground">Sua conta ({access.user.email}) é de cliente. Peça ao administrador do MaisBarato para ligá-la ao seu supermercado.</p>
        </Card>
      </AppShell>
    );

  return (
    <AppShell>
      {title}
      {scan && (
        <BarcodeScanner
          onClose={() => setScan(false)}
          onDetected={(code) => { setScan(false); set({ barcode: code }); toast.success(`Código lido: ${code}`); }}
        />
      )}

      <Card title="Supermercado">
        {mf ? (
          <form onSubmit={saveMarket} className="space-y-2">
            <L label="Nome do supermercado"><input className={field} value={mf.name} onChange={(e) => setMf({ ...mf, name: e.target.value })} /></L>
            <L label="Bairro"><input className={field} value={mf.neighborhood} onChange={(e) => setMf({ ...mf, neighborhood: e.target.value })} /></L>
            <L label="Endereço comercial (opcional)"><input className={field} value={mf.address} onChange={(e) => setMf({ ...mf, address: e.target.value })} placeholder="Rua, número" /></L>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={btn2} onClick={() => setMf(null)}>Cancelar</button>
              <button disabled={busy} className={btn}>Salvar</button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <L label="Você está gerenciando">
              <select className={field} value={market?.id} onChange={(e) => { setMarketId(e.target.value); setIt(emptyItem()); }}>
                {catalog.markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </L>
            {market && (
              <p className="text-sm text-muted-foreground">
                {market.neighborhood} · {market.address || "Endereço não informado"}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {market && <button className={btn2} onClick={() => setMf({ ...market })}>Editar mercado</button>}
              {access.isAdmin && <button className={btn2} onClick={() => setMf({ name: "", neighborhood: "", address: "" })}>Novo mercado</button>}
            </div>
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div id="form-produto" className="scroll-mt-20">
          <Card title={it.productId ? "Editar produto e preço" : "Cadastrar produto e preço"}>
            <form onSubmit={saveItem} className="space-y-2">
              <L label="Código de barras (EAN/UPC)">
                <div className="flex gap-2">
                  <input className={field} inputMode="numeric" value={it.barcode} onChange={(e) => set({ barcode: e.target.value.replace(/\D/g, "").slice(0, 14) })} placeholder="Digite ou escaneie" />
                  <button type="button" onClick={() => setScan(true)} aria-label="Escanear código de barras" className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted">
                    <ScanBarcode className="h-5 w-5" /><span className="hidden sm:inline">Escanear código de barras</span>
                  </button>
                </div>
              </L>
              {dupBarcode && (
                <div className="rounded-xl bg-secondary p-3 text-sm">
                  Já existe um produto com este código: <strong>{dupBarcode.name}</strong> ({dupBarcode.brand} · {sizeLabel(dupBarcode)}).
                  <button type="button" className="mt-2 block font-semibold text-primary underline" onClick={() => editItem(dupBarcode.id)}>Usar este produto</button>
                </div>
              )}
              {it.productId && !canEditShared && (
                <p className="rounded-xl bg-secondary p-3 text-sm">
                  Nome, marca e foto deste produto só podem ser alterados pelos mercados que o vendem. Você pode cadastrar o preço e a oferta do seu mercado.
                </p>
              )}
              <L label="Nome do produto"><input className={field} disabled={!canEditShared} value={it.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Macarrão espaguete" /></L>
              <L label="Marca"><input className={field} disabled={!canEditShared} value={it.brand} onChange={(e) => set({ brand: e.target.value })} /></L>
              <L label="Categoria">
                <select className={field} value={it.category} onChange={(e) => set({ category: e.target.value })}>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </L>
              <div className="grid grid-cols-2 gap-2">
                <L label="Peso ou volume"><input className={field} inputMode="decimal" value={it.size} onChange={(e) => set({ size: e.target.value })} /></L>
                <L label="Unidade">
                  <select className={field} value={it.unit} onChange={(e) => set({ unit: e.target.value as Unit })}>
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </L>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <L label="Preço (R$)"><input className={field} inputMode="decimal" value={it.price} onChange={(e) => set({ price: e.target.value })} placeholder="0,00" /></L>
                <L label="Data da atualização"><input type="date" max={todayISO()} className={field} value={it.updatedAt} onChange={(e) => set({ updatedAt: e.target.value })} /></L>
              </div>
              <label className="flex items-center gap-2 py-1 text-sm font-semibold">
                <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={it.hasOffer} onChange={(e) => set({ hasOffer: e.target.checked })} />
                Produto em oferta
              </label>
              {it.hasOffer && (
                <div className="grid grid-cols-2 gap-2">
                  <L label="Preço da oferta (R$)"><input className={field} inputMode="decimal" value={it.offerPrice} onChange={(e) => set({ offerPrice: e.target.value })} placeholder="0,00" /></L>
                  <L label="Válida até"><input type="date" min={todayISO()} className={field} value={it.validUntil} onChange={(e) => set({ validUntil: e.target.value })} /></L>
                </div>
              )}
              <PhotoPicker value={it.photo} onChange={(photo) => set({ photo })} disabled={!canEditShared} />
              <div className={`grid gap-2 ${it.productId ? "grid-cols-2" : ""}`}>
                {it.productId && <button type="button" className={btn2} onClick={() => setIt(emptyItem())}>Cancelar</button>}
                <button disabled={busy} className={`${btn} disabled:opacity-60`}>{busy ? "Salvando…" : it.productId ? "Salvar alterações" : "Cadastrar"}</button>
              </div>
            </form>
          </Card>
        </div>

        <Card title={`Preços de ${market?.name ?? "—"}`}>
          <ul className="divide-y divide-border text-sm">
            {myPrices.map((pr) => {
              const p = catalog.products.find((x) => x.id === pr.productId);
              const o = catalog.offers.find((x) => x.productId === pr.productId && x.marketId === pr.marketId);
              if (!p) return null;
              return (
                <li key={pr.productId} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-[11px] text-muted-foreground">{p.brand} · {sizeLabel(p)} · atualizado em {fmtDate(pr.updatedAt)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <strong>{brl(pr.price)}</strong>
                    {o && <span className="block text-[11px] text-success">oferta {brl(o.price)} até {fmtDate(o.validUntil)}</span>}
                  </span>
                  <button onClick={() => editItem(p.id)} aria-label={`Editar ${p.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-muted">
                    <Pencil className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
            {!myPrices.length && <li className="py-2 text-muted-foreground">Nenhum preço cadastrado neste mercado.</li>}
          </ul>
        </Card>
      </div>

      {access.isAdmin && <AdminPanel markets={all.markets} />}
      {access.isAdmin && (
        <button
          className="mt-4 text-sm font-semibold text-destructive"
          onClick={async () => {
            try { await catalogRepo.resetDemo(); await refresh(); setIt(emptyItem()); toast.success("Dados de demonstração restaurados (dados reais não foram alterados)"); }
            catch (err) { toast.error((err as Error).message); }
          }}
        >
          Restaurar dados de demonstração
        </button>
      )}
    </AppShell>
  );
}
