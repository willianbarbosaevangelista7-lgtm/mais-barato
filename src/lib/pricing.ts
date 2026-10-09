import type { Catalog, ListItem, Product } from "./types";

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
export const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
export const todayISO = () => new Date().toISOString().slice(0, 10);

export function sizeLabel(p: Product) {
  return `${p.size.toLocaleString("pt-BR")} ${p.unit}`;
}

/** Unit price normalized to R$/kg, R$/L or R$/un, for comparing equivalent products. */
export function unitPrice(p: Product, price: number) {
  const base = p.unit === "g" || p.unit === "ml" ? p.size / 1000 : p.size;
  const unit = p.unit === "g" ? "kg" : p.unit === "ml" ? "L" : p.unit;
  return { value: price / base, unit };
}

/** Only products measured in the same dimension (weight, volume, units) can be compared by unit price. */
export const dimension = (p: Product) => (p.unit === "g" || p.unit === "kg" ? "peso" : p.unit === "ml" || p.unit === "L" ? "volume" : "un");
export const comparable = (a: Product, b: Product) => a.group === b.group && dimension(a) === dimension(b);

/** Parses "12,90" or "12.90" into a number (NaN when invalid). */
export const parseMoney = (s: string) => Number(s.trim().replace(/\./g, (m, i, str) => (str.includes(",") ? "" : m)).replace(",", "."));

export interface MarketPrice {
  marketId: string;
  marketName: string;
  price: number;
  updatedAt: string;
  isOffer: boolean;
  validUntil?: string | undefined;
}

export function pricesFor(catalog: Catalog, productId: string, today = todayISO()): MarketPrice[] {
  return catalog.prices
    .filter((p) => p.productId === productId)
    .map((p) => {
      const offer = catalog.offers.find(
        (o) => o.productId === productId && o.marketId === p.marketId && o.validUntil >= today && o.price < p.price,
      );
      return {
        marketId: p.marketId,
        marketName: catalog.markets.find((m) => m.id === p.marketId)?.name ?? "—",
        price: offer ? offer.price : p.price,
        updatedAt: p.updatedAt,
        isOffer: !!offer,
        validUntil: offer?.validUntil,
      };
    })
    .sort((a, b) => a.price - b.price);
}

export function priceSummary(prices: MarketPrice[]) {
  const first = prices[0];
  const last = prices[prices.length - 1];
  if (!first || !last) return null;
  const min = first.price;
  const max = last.price;
  return { min, max, diff: max - min, diffPct: max > 0 ? ((max - min) / max) * 100 : 0, cheapest: first };
}

export interface ListAnalysis {
  rows: { item: ListItem; product: Product; best?: MarketPrice | undefined; worst?: MarketPrice | undefined }[];
  splitTotal: number;
  worstTotal: number;
  potentialSavings: number;
  markets: { marketId: string; name: string; total: number; missing: number }[];
  bestSingle?: { marketId: string; name: string; total: number } | undefined;
}

export function analyzeList(catalog: Catalog, list: ListItem[]): ListAnalysis {
  const rows = list
    .map((item) => {
      const product = catalog.products.find((p) => p.id === item.productId);
      if (!product) return null;
      const prices = pricesFor(catalog, item.productId);
      return { item, product, best: prices[0], worst: prices[prices.length - 1], prices };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const splitTotal = rows.reduce((s, r) => s + (r.best?.price ?? 0) * r.item.qty, 0);
  const worstTotal = rows.reduce((s, r) => s + (r.worst?.price ?? 0) * r.item.qty, 0);

  const markets = catalog.markets.map((m) => {
    let total = 0;
    let missing = 0;
    for (const r of rows) {
      const mp = r.prices.find((p) => p.marketId === m.id);
      if (mp) total += mp.price * r.item.qty;
      else missing++;
    }
    return { marketId: m.id, name: m.name, total, missing };
  });
  const complete = markets.filter((m) => m.missing === 0).sort((a, b) => a.total - b.total);

  return {
    rows: rows.map(({ prices: _p, ...r }) => r),
    splitTotal,
    worstTotal,
    potentialSavings: worstTotal - splitTotal,
    markets,
    bestSingle: rows.length ? complete[0] : undefined,
  };
}
