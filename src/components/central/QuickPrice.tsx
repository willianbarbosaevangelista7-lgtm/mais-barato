import { useCallback, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ScanBarcode } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { barcodeError } from "@/lib/barcode";
import { catalogRepo, newId } from "@/lib/repository";
import { brl, fmtDate, parseMoney, sizeLabel, todayISO } from "@/lib/pricing";
import { SOURCE_LABEL } from "@/lib/catalog-cloud";
import type { Catalog, Market } from "@/lib/types";
import { btn, field } from "./ui";

/** Quick price update by EAN (camera or typed). Never creates duplicate products. */
export function QuickPrice({ catalog, market }: { catalog: Catalog; market: Market }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [scan, setScan] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [price, setPrice] = useState("");
  const [offer, setOffer] = useState("");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const onDetected = useCallback((c: string) => { setScan(false); setCode(c); setScanned(true); }, []);
  const onClose = useCallback(() => setScan(false), []);

  const product = code.length >= 8 ? catalog.products.find((p) => p.barcode === code) : undefined;
  const current = product && catalog.prices.find((p) => p.productId === product.id && p.marketId === market.id);
  const currentOffer = product && catalog.offers.find((o) => o.productId === product.id && o.marketId === market.id);
  const err = code ? barcodeError(code) : null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const p = parseMoney(price);
    if (!(p > 0)) return void toast.error("Informe um preço válido.");
    let o: { id: string; price: number; validUntil: string } | null = null;
    if (offer.trim()) {
      const op = parseMoney(offer);
      if (!(op > 0) || op >= p) return void toast.error(`O preço da oferta deve ser menor que ${brl(p)}.`);
      if (!until || until < todayISO()) return void toast.error("A validade da oferta deve ser hoje ou depois.");
      o = { id: newId("o"), price: op, validUntil: until };
    }
    setBusy(true);
    try {
      await catalogRepo.saveItem({ product, marketId: market.id, price: p, updatedAt: todayISO(), offer: o, source: scanned ? "scan" : "manual" });
      await qc.invalidateQueries({ queryKey: ["catalog"] });
      qc.invalidateQueries({ queryKey: ["history"] });
      toast.success(`Preço de ${product.name} atualizado`);
      setCode(""); setPrice(""); setOffer(""); setUntil(""); setScanned(false);
    } catch (e2) { toast.error((e2 as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      {scan && <BarcodeScanner onDetected={onDetected} onClose={onClose} />}
      <div className="flex gap-2">
        <input aria-label="Código de barras" className={field} inputMode="numeric" placeholder="Digite ou escaneie o EAN"
          value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 14)); setScanned(false); }} />
        <button type="button" onClick={() => setScan(true)} className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted">
          <ScanBarcode className="h-5 w-5" /><span className="hidden sm:inline">Escanear</span>
        </button>
      </div>
      {err && code.length >= 8 && <p className="text-sm text-destructive">{err}</p>}
      {code.length >= 8 && !err && !product && (
        <p className="rounded-xl bg-secondary p-3 text-sm">Produto não encontrado. Cadastre-o em "Cadastrar produto e preço" na área Mercados — ele ficará pendente até a aprovação do administrador.</p>
      )}
      {product && (
        <form onSubmit={save} className="space-y-2 rounded-xl border border-border p-3">
          <p className="font-semibold">{product.name} <span className="font-normal text-muted-foreground">· {product.brand} · {sizeLabel(product)}</span></p>
          {product.status === "pending" && <p className="text-xs text-muted-foreground">Aguardando aprovação: ainda não aparece para os clientes.</p>}
          <p className="text-xs text-muted-foreground">
            {current ? <>Preço atual {brl(current.price)} · {fmtDate(current.updatedAt)}{current.source ? ` · ${SOURCE_LABEL[current.source]}` : ""}</> : "Ainda sem preço neste mercado."}
            {currentOffer && <> · oferta {brl(currentOffer.price)} até {fmtDate(currentOffer.validUntil)}</>}
          </p>
          <input aria-label="Novo preço" className={field} inputMode="decimal" placeholder="Novo preço (R$)" value={price} onChange={(e) => setPrice(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="Preço de oferta" className={field} inputMode="decimal" placeholder="Oferta (opcional)" value={offer} onChange={(e) => setOffer(e.target.value)} />
            <input aria-label="Validade da oferta" type="date" min={todayISO()} className={field} value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
          <button disabled={busy} className={`${btn} disabled:opacity-60`}>{busy ? "Salvando…" : "Salvar preço"}</button>
        </form>
      )}
    </div>
  );
}
