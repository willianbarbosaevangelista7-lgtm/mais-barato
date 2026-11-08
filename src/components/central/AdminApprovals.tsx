import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { catalogRepo } from "@/lib/repository";
import { sizeLabel } from "@/lib/pricing";
import type { Catalog, Product, ProductStatus } from "@/lib/types";
import { categories } from "@/lib/categories";
import { field } from "./ui";

const LABEL: Record<ProductStatus, string> = { pending: "Pendentes", approved: "Aprovados", rejected: "Rejeitados / ocultos" };

/** Admin only (database trigger + RLS enforce it): approve, edit, reject or remove products. */
export function AdminApprovals({ catalog }: { catalog: Catalog }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<ProductStatus>("pending");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Product | null>(null);
  const list = catalog.products
    .filter((p) => (p.status ?? "approved") === tab)
    .filter((p) => !q || `${p.name} ${p.brand} ${p.barcode ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 100);
  const refresh = () => qc.invalidateQueries({ queryKey: ["catalog"] });

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); await refresh(); toast.success(ok); } catch (e) { toast.error((e as Error).message); }
  };
  const saveEdit = async () => {
    if (!edit) return;
    const market = catalog.prices.find((p) => p.productId === edit.id);
    if (!market) return void toast.error("Produto sem preço: edite pelo cadastro na área Mercados.");
    const offer = catalog.offers.find((o) => o.productId === edit.id && o.marketId === market.marketId);
    await run(() => catalogRepo.saveItem({
      product: edit, marketId: market.marketId, price: market.price, updatedAt: market.updatedAt,
      offer: offer ? { id: offer.id, price: offer.price, validUntil: offer.validUntil } : null, source: "admin",
    }), "Produto atualizado");
    setEdit(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LABEL) as ProductStatus[]).map((s) => (
          <button key={s} aria-pressed={tab === s} onClick={() => setTab(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tab === s ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
            {LABEL[s]} ({catalog.products.filter((p) => (p.status ?? "approved") === s).length})
          </button>
        ))}
      </div>
      <input aria-label="Filtrar produtos" className={field} placeholder="Filtrar por nome, marca ou EAN" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="divide-y divide-border rounded-xl border border-border text-sm">
        {list.map((p) => {
          const sellers = catalog.prices.filter((x) => x.productId === p.id).length;
          return (
            <li key={p.id} className="p-3">
              {edit?.id === p.id ? (
                <div className="space-y-2">
                  <input aria-label="Nome" className={field} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                  <input aria-label="Marca" className={field} value={edit.brand} onChange={(e) => setEdit({ ...edit, brand: e.target.value })} />
                  <select aria-label="Categoria" className={field} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                    {categories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <div className="flex gap-3 text-xs font-semibold">
                    <button className="text-primary underline" onClick={() => void saveEdit()}>Salvar</button>
                    <button className="underline" onClick={() => setEdit(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-medium">{p.name} <span className="font-normal text-muted-foreground">· {p.brand} · {sizeLabel(p)}</span></p>
                  <p className="text-[11px] text-muted-foreground">{p.category} · {p.barcode ?? "sem EAN"} · {sellers} mercado(s)</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
                    {tab !== "approved" && <button className="text-success underline" onClick={() => void run(() => catalogRepo.setProductStatus(p.id, "approved"), "Produto aprovado")}>Aprovar</button>}
                    <button className="text-primary underline" onClick={() => setEdit(p)}>Editar</button>
                    {tab !== "rejected" && <button className="underline" onClick={() => void run(() => catalogRepo.setProductStatus(p.id, "rejected"), "Produto rejeitado (oculto)")}>Rejeitar</button>}
                    <button className="text-destructive underline" onClick={() => {
                      if (!confirm(`Remover "${p.name}"? Se já tiver preços, ele será apenas ocultado.`)) return;
                      void run(async () => toast.info((await catalogRepo.removeProduct(p.id)) === "deleted" ? "Removido" : "Tinha preços: foi ocultado"), "Concluído");
                    }}>Remover</button>
                  </div>
                </>
              )}
            </li>
          );
        })}
        {!list.length && <li className="p-3 text-muted-foreground">Nada aqui.</li>}
      </ul>
    </div>
  );
}
