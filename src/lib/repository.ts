import { demoCatalog } from "./demo-data";
import { catalogStore } from "./store";
import type { Market, Offer, Price, Product } from "./types";

/**
 * All catalog writes go through this interface. Today it is backed by localStorage;
 * a future shared backend only needs another implementation with the same methods.
 */
export interface CatalogRepository {
  saveMarket(m: Market): void;
  saveProduct(p: Product): void;
  savePrice(p: Price): void;
  saveOffer(o: Offer): void;
  removeOffer(productId: string, marketId: string): void;
  reset(): void;
}

const upsert = <T,>(arr: T[], item: T, same: (a: T) => boolean) =>
  arr.some(same) ? arr.map((a) => (same(a) ? item : a)) : [...arr, item];

export const localCatalogRepository: CatalogRepository = {
  saveMarket: (m) => catalogStore.set((c) => ({ ...c, markets: upsert(c.markets, m, (x) => x.id === m.id) })),
  saveProduct: (p) => catalogStore.set((c) => ({ ...c, products: upsert(c.products, p, (x) => x.id === p.id) })),
  savePrice: (p) =>
    catalogStore.set((c) => ({
      ...c,
      prices: upsert(c.prices, p, (x) => x.productId === p.productId && x.marketId === p.marketId),
    })),
  saveOffer: (o) =>
    catalogStore.set((c) => ({
      ...c,
      offers: upsert(c.offers, o, (x) => x.productId === o.productId && x.marketId === o.marketId),
    })),
  removeOffer: (productId, marketId) =>
    catalogStore.set((c) => ({
      ...c,
      offers: c.offers.filter((x) => !(x.productId === productId && x.marketId === marketId)),
    })),
  reset: () => catalogStore.set(demoCatalog),
};

export const catalogRepo: CatalogRepository = localCatalogRepository;

export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const groupKey = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "-");
