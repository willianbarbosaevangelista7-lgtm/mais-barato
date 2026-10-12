import { supabase } from "@/integrations/supabase/client";
import { demoCatalog } from "./demo-data";
import { IMAGE_BUCKET } from "./catalog-cloud";
import type { Market, Product } from "./types";

export interface SaveItemInput {
  product: Product;
  marketId: string;
  price: number;
  updatedAt: string;
  offer: { id: string; price: number; validUntil: string } | null;
}

/**
 * All catalog writes go through this interface. Backed by Lovable Cloud; database
 * security rules decide who may write (market members / admin).
 */
export interface CatalogRepository {
  saveMarket(m: Market, isNew: boolean): Promise<void>;
  /** Product + price + offer saved atomically in the database. */
  saveItem(input: SaveItemInput): Promise<void>;
  uploadImage(productId: string, blob: Blob): Promise<string>;
  removeImage(path: string): Promise<void>;
  /** Admin only: restores demo records; real data is never touched. */
  resetDemo(): Promise<void>;
}

const fail = (e: { message: string; code?: string } | null) => {
  if (!e) return;
  if (e.code === "23505") throw new Error("Já existe um produto com este código de barras.");
  if (e.code === "42501" || /row-level security|permission/i.test(e.message))
    throw new Error("Você não tem permissão para esta alteração.");
  throw new Error(e.message);
};

export const cloudCatalogRepository: CatalogRepository = {
  async saveMarket(m, isNew) {
    const row = { id: m.id, name: m.name, neighborhood: m.neighborhood, address: m.address };
    const { error } = isNew
      ? await supabase.from("markets").insert(row)
      : await supabase.from("markets").update(row).eq("id", m.id);
    fail(error);
  },
  async saveItem({ product, marketId, price, updatedAt, offer }) {
    const { error } = await supabase.rpc("save_market_item", {
      p_product: { ...product, barcode: product.barcode ?? "", imagePath: product.imagePath ?? "" },
      p_market_id: marketId,
      p_price: price,
      p_updated_at: updatedAt,
      p_offer_id: offer?.id ?? "",
      p_offer_price: (offer?.price ?? null) as number,
      p_valid_until: (offer?.validUntil ?? null) as string,
    });
    fail(error);
  },
  async uploadImage(productId, blob) {
    const path = `${productId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
    fail(error);
    return path;
  },
  async removeImage(path) {
    await supabase.storage.from(IMAGE_BUCKET).remove([path]);
  },
  async resetDemo() {
    const c = demoCatalog;
    fail((await supabase.from("markets").upsert(c.markets.map((m) => ({ ...m, is_demo: true })))).error);
    fail((await supabase.from("products").upsert(c.products.map((p) => ({
      id: p.id, name: p.name, brand: p.brand, category: p.category, size: p.size, unit: p.unit, emoji: p.emoji, group_key: p.group, is_demo: true,
    })))).error);
    fail((await supabase.from("prices").upsert(c.prices.map((p) => ({ product_id: p.productId, market_id: p.marketId, price: p.price, updated_at: p.updatedAt })))).error);
    fail((await supabase.from("offers").upsert(c.offers.map((o) => ({ id: o.id, product_id: o.productId, market_id: o.marketId, price: o.price, valid_until: o.validUntil })), { onConflict: "product_id,market_id" })).error);
  },
};

export const catalogRepo: CatalogRepository = cloudCatalogRepository;

export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const groupKey = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "-");
