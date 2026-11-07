import { barcodeError } from "./barcode";
import { categories } from "./categories";
import { parseMoney, todayISO } from "./pricing";
import type { Catalog } from "./types";
import type { ImportRowInput } from "./repository";

export const MAX_IMPORT_ROWS = 2000;
export const TEMPLATE_HEADERS = ["ean", "nome", "marca", "categoria", "tamanho", "unidade", "preco", "preco_oferta", "validade_oferta"];
const UNITS = ["kg", "g", "L", "ml", "un"];

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[\s-]+/g, "_");
const ALIASES: Record<string, string> = {
  ean: "ean", codigo: "ean", codigo_de_barras: "ean", gtin: "ean", barcode: "ean",
  nome: "nome", produto: "nome", descricao: "nome",
  marca: "marca", categoria: "categoria",
  tamanho: "tamanho", peso: "tamanho", volume: "tamanho", quantidade: "tamanho",
  unidade: "unidade", un: "unidade",
  preco: "preco", valor: "preco", preco_normal: "preco",
  preco_oferta: "preco_oferta", oferta: "preco_oferta",
  validade_oferta: "validade_oferta", validade: "validade_oferta", valido_ate: "validade_oferta",
};

export type RawRow = Record<string, unknown>;

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = str(v);
  if (!s) return null;
  const n = parseMoney(s.replace(/R\$\s*/i, ""));
  return Number.isFinite(n) ? n : null;
};
/** Accepts YYYY-MM-DD, DD/MM/YYYY or an Excel serial date. */
export function parseDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 30000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = str(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return null;
}
const unitOf = (v: unknown) => {
  const s = str(v).toLowerCase();
  if (s === "l" || s === "lt" || s === "litro" || s === "litros") return "L";
  if (s === "un" || s === "und" || s === "unidade" || s === "unid") return "un";
  return UNITS.find((u) => u.toLowerCase() === s) ?? "";
};

/** Maps spreadsheet columns (Portuguese headers, with or without accents) to our fields. */
export function mapRow(raw: RawRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = ALIASES[norm(k)];
    if (key && out[key] === undefined) out[key] = v;
  }
  return out;
}

/** Validates rows against the catalog. Existing EAN = price update (never a duplicate product). */
export function validateRows(raws: RawRow[], catalog: Catalog, marketId: string, today = todayISO()): ImportRowInput[] {
  const seen = new Map<string, number>();
  return raws.slice(0, MAX_IMPORT_ROWS).map((raw, i) => {
    const r = mapRow(raw);
    const errors: string[] = [];
    const warnings: string[] = [];
    const barcode = str(r["ean"]).replace(/\D/g, "");
    const name = str(r["nome"]);
    const price = num(r["preco"]);
    const offer = num(r["preco_oferta"]);
    const validUntil = parseDate(r["validade_oferta"]);
    const size = num(r["tamanho"]);
    const unit = unitOf(r["unidade"]);
    let category = str(r["categoria"]);
    const catMatch = categories.find((c) => norm(c) === norm(category));
    if (catMatch) category = catMatch;

    const bErr = barcodeError(barcode);
    if (!barcode) warnings.push("Sem código de barras: o produto será identificado pelo nome.");
    else if (bErr) errors.push(bErr);
    if (barcode && seen.has(barcode)) errors.push(`Código repetido na linha ${seen.get(barcode)}.`);
    if (barcode) seen.set(barcode, i + 2);

    const existing = barcode ? catalog.products.find((p) => p.barcode === barcode) : undefined;
    if (price === null || !(price > 0)) errors.push("Preço inválido ou ausente.");
    if (offer !== null) {
      if (!(offer > 0) || (price !== null && offer >= price)) errors.push("O preço da oferta deve ser menor que o preço normal.");
      if (!validUntil) errors.push("Informe a validade da oferta (DD/MM/AAAA).");
      else if (validUntil < today) errors.push("A validade da oferta já passou.");
    }
    if (!existing) {
      if (name.length < 2) errors.push("Produto novo sem nome.");
      if (!catMatch) errors.push(category ? `Categoria "${category}" não existe.` : "Produto novo sem categoria.");
      if (!(size && size > 0)) errors.push("Produto novo sem peso ou volume.");
      if (!unit) errors.push("Unidade inválida (use kg, g, L, ml ou un).");
    } else {
      const current = catalog.prices.find((p) => p.productId === existing.id && p.marketId === marketId);
      if (current && price && Math.abs(price - current.price) / current.price > 0.5)
        warnings.push(`Variação grande: preço atual R$ ${current.price.toFixed(2).replace(".", ",")}.`);
      if (name && norm(name) !== norm(existing.name)) warnings.push(`Já cadastrado como "${existing.name}"; o nome não será alterado.`);
    }
    return {
      row_no: i + 2,
      barcode, name: existing?.name ?? name, brand: existing?.brand ?? str(r["marca"]), category: existing?.category ?? category,
      size: existing?.size ?? size, unit: existing?.unit ?? (unit || "un"),
      price, offer_price: offer, valid_until: offer !== null ? validUntil : null,
      product_id: existing?.id ?? null,
      action: existing ? "update" : "create",
      errors, warnings,
    };
  });
}

/** Reads an .xlsx/.xls/.csv file in the browser. */
export async function readSheet(file: File): Promise<RawRow[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = /\.csv$/i.test(file.name)
    ? XLSX.read(new TextDecoder().decode(buf), { type: "string", raw: true, FS: guessSeparator(new TextDecoder().decode(buf)) })
    : XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "", raw: true });
}
const guessSeparator = (text: string) => {
  const first = text.split(/\r?\n/)[0] ?? "";
  return (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
};

export async function downloadTemplate() {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ["7891234567895", "Arroz branco tipo 1", "Marca Exemplo", "Arroz e grãos", 5, "kg", "24,90", "", ""]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produtos");
  XLSX.writeFile(wb, "modelo-maisbarato.xlsx");
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
}
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const blob = new Blob(["\ufeff" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
