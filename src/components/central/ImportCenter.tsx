import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, FileSpreadsheet, Download } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/components/PhotoPicker";
import { downloadTemplate, MAX_IMPORT_ROWS, readSheet, validateRows } from "@/lib/import";
import { readPriceLabel } from "@/lib/label-photo.functions";
import { catalogRepo, type ImportKind } from "@/lib/repository";
import { brl, parseMoney } from "@/lib/pricing";
import type { Catalog, Market } from "@/lib/types";
import { btn, btn2, fmtDateTime } from "./ui";

const KIND: Record<string, string> = { xlsx: "Excel", csv: "CSV", label_photo: "Foto de etiqueta" };
const STATUS: Record<string, string> = { review: "Em revisão", published: "Publicado", discarded: "Descartado" };

const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(b);
});

export function ImportCenter({ catalog, market }: { catalog: Catalog; market: Market }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const readLabel = useServerFn(readPriceLabel);
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const batches = useQuery({
    queryKey: ["batches", market.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("import_batches").select("*").eq("market_id", market.id).order("created_at", { ascending: false }).limit(30);
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const stage = async (kind: ImportKind, name: string, raws: Record<string, unknown>[]) => {
    if (!raws.length) return void toast.error("Nenhuma linha encontrada no arquivo.");
    if (raws.length > MAX_IMPORT_ROWS) toast.warning(`Só as primeiras ${MAX_IMPORT_ROWS} linhas serão importadas.`);
    const rows = validateRows(raws, catalog, market.id);
    const id = await catalogRepo.createImportBatch(market.id, kind, name, rows);
    await qc.invalidateQueries({ queryKey: ["batches", market.id] });
    setOpen(id);
    toast.success("Enviado para revisão. Nada foi publicado ainda.");
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy("Lendo planilha…");
    try { await stage(/\.csv$/i.test(f.name) ? "csv" : "xlsx", f.name, await readSheet(f)); }
    catch (e) { toast.error((e as Error).message || "Não foi possível ler o arquivo."); }
    finally { setBusy(""); if (fileRef.current) fileRef.current.value = ""; }
  };

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    setBusy("Lendo etiqueta com IA…");
    try {
      const image = await toDataUrl(await compressImage(f));
      const r = await readLabel({ data: { image } });
      if (!r.result) return void toast.error(r.error ?? "Não foi possível ler a etiqueta.");
      await stage("label_photo", f.name || "foto", [r.result]);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(""); if (photoRef.current) photoRef.current.value = ""; }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <button className={`${btn} inline-flex items-center justify-center gap-2`} disabled={!!busy} onClick={() => fileRef.current?.click()}>
          <FileSpreadsheet className="h-5 w-5" />Importar Excel ou CSV
        </button>
        <button className={`${btn2} inline-flex items-center justify-center gap-2`} disabled={!!busy} onClick={() => photoRef.current?.click()}>
          <Camera className="h-5 w-5" />Foto de etiqueta (IA)
        </button>
        <button className={`${btn2} inline-flex items-center justify-center gap-2`} onClick={() => void downloadTemplate()}>
          <Download className="h-5 w-5" />Baixar modelo
        </button>
      </div>
      <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => void onFile(e.target.files?.[0])} />
      <input ref={photoRef} type="file" hidden accept="image/*" capture="environment" onChange={(e) => void onPhoto(e.target.files?.[0])} />
      {busy && <p className="text-sm text-muted-foreground">{busy}</p>}
      <p className="text-xs text-muted-foreground">Colunas: ean, nome, marca, categoria, tamanho, unidade, preco, preco_oferta, validade_oferta. Produtos com código já cadastrado só têm o preço atualizado. Tudo passa pela revisão antes de aparecer para os clientes.</p>

      <h3 className="pt-2 text-sm font-bold">Lotes de {market.name}</h3>
      <ul className="divide-y divide-border rounded-xl border border-border text-sm">
        {batches.data?.map((b) => (
          <li key={b.id} className="p-3">
            <button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen(open === b.id ? null : b.id)}>
              <span className="min-w-0">
                <span className="block truncate font-medium">{KIND[b.kind]} · {b.file_name}</span>
                <span className="text-[11px] text-muted-foreground">{fmtDateTime(b.created_at)} · {b.total} linha(s){b.status === "published" ? ` · ${b.published} publicada(s)` : ""}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.status === "review" ? "bg-secondary" : b.status === "published" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{STATUS[b.status]}</span>
            </button>
            {open === b.id && <Review batchId={b.id} status={b.status} marketId={market.id} />}
          </li>
        ))}
        {!batches.data?.length && <li className="p-3 text-muted-foreground">Nenhuma importação ainda.</li>}
      </ul>
    </div>
  );
}

function Review({ batchId, status, marketId }: { batchId: string; status: string; marketId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const rows = useQuery({
    queryKey: ["import-rows", batchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("import_rows").select("*").eq("batch_id", batchId).order("row_no");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["import-rows", batchId] });
  const editable = status === "review";
  const valid = rows.data?.filter((r) => r.action !== "skip" && !r.errors.length).length ?? 0;
  const invalid = rows.data?.filter((r) => r.action !== "skip" && r.errors.length).length ?? 0;

  const setPrice = async (id: string, value: string, errors: string[]) => {
    const p = parseMoney(value);
    if (!(p > 0)) return void toast.error("Preço inválido.");
    await catalogRepo.updateImportRow(id, { price: p, errors: errors.filter((e) => !/Preço inválido/.test(e)) });
    reload();
  };
  const toggleSkip = async (id: string, action: string, productId: string | null) => {
    await catalogRepo.updateImportRow(id, { action: action === "skip" ? (productId ? "update" : "create") : "skip" });
    reload();
  };
  const publish = async () => {
    setBusy(true);
    try {
      const n = await catalogRepo.publishBatch(batchId);
      toast.success(`${n} preço(s) publicado(s).`);
      await Promise.all([reload(), qc.invalidateQueries({ queryKey: ["batches", marketId] }), qc.invalidateQueries({ queryKey: ["catalog"] }), qc.invalidateQueries({ queryKey: ["history"] })]);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const discard = async () => {
    await catalogRepo.discardBatch(batchId);
    qc.invalidateQueries({ queryKey: ["batches", marketId] });
  };

  if (rows.isLoading) return <p className="mt-2 text-xs text-muted-foreground">Carregando linhas…</p>;
  return (
    <div className="mt-3 space-y-2">
      {editable && <p className="text-xs">{valid} pronta(s) para publicar · {invalid} com erro (não serão publicadas)</p>}
      <div className="max-h-96 overflow-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted text-left">
            <tr><th className="p-2">Linha</th><th className="p-2">Produto</th><th className="p-2">Preço</th><th className="p-2">Situação</th>{editable && <th className="p-2" />}</tr>
          </thead>
          <tbody>
            {rows.data?.map((r) => (
              <tr key={r.id} className={`border-t border-border align-top ${r.action === "skip" ? "opacity-50" : ""}`}>
                <td className="p-2">{r.row_no}</td>
                <td className="p-2">
                  <span className="font-medium">{r.name || "—"}</span>
                  <span className="block text-muted-foreground">{r.barcode || "sem EAN"} · {r.action === "update" ? "atualiza preço" : r.action === "create" ? "produto novo (aprovação)" : "ignorada"}</span>
                </td>
                <td className="p-2">
                  {editable ? (
                    <input aria-label={`Preço linha ${r.row_no}`} defaultValue={r.price != null ? String(r.price).replace(".", ",") : ""} inputMode="decimal"
                      className="h-8 w-20 rounded-md border border-input bg-card px-1"
                      onBlur={(e) => { if (e.target.value && Number(r.price) !== parseMoney(e.target.value)) void setPrice(r.id, e.target.value, r.errors); }} />
                  ) : r.price != null ? brl(Number(r.price)) : "—"}
                  {r.offer_price != null && <span className="block text-success">oferta {brl(Number(r.offer_price))}</span>}
                </td>
                <td className="p-2">
                  {r.errors.map((e) => <span key={e} className="block text-destructive">{e}</span>)}
                  {r.warnings.map((w) => <span key={w} className="block text-muted-foreground">{w}</span>)}
                  {!r.errors.length && !r.warnings.length && <span className="text-success">OK</span>}
                </td>
                {editable && (
                  <td className="p-2"><button className="font-semibold text-primary underline" onClick={() => void toggleSkip(r.id, r.action, r.product_id)}>{r.action === "skip" ? "Incluir" : "Ignorar"}</button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="grid grid-cols-2 gap-2">
          <button className={btn2} onClick={() => void discard()}>Descartar lote</button>
          <button className={`${btn} disabled:opacity-60`} disabled={busy || !valid} onClick={() => void publish()}>{busy ? "Publicando…" : `Publicar ${valid}`}</button>
        </div>
      )}
    </div>
  );
}
