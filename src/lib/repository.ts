import { supabase } from "@/integrations/supabase/client";
import { demoCatalog } from "./demo-data";
import { IMAGE_BUCKET } from "./catalog-cloud";
import type { Market, PriceSource, Product, ProductStatus } from "./types";

export interface SaveItemInput {
  product: Product;
  marketId: string;
  price: number;
  updatedAt: string;
  offer: { id: string; price: number; validUntil: string } | null;
  source?: PriceSource;
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
  /** Imports: rows are staged for review and only reach consumers after publishBatch. */
  createImportBatch(marketId: string, kind: ImportKind, fileName: string, rows: ImportRowInput[]): Promise<string>;
  updateImportRow(id: string, patch: Partial<ImportRowInput>): Promise<void>;
  publishBatch(batchId: string): Promise<number>;
  discardBatch(batchId: string): Promise<void>;
  /** Admin only (enforced by a database trigger). */
  setProductStatus(productId: string, status: ProductStatus): Promise<void>;
  /** Admin only: deletes when unused, otherwise hides (rejected) to keep history. */
  removeProduct(productId: string): Promise<"deleted" | "hidden">;
  unlinkMember(userId: string, marketId: string): Promise<void>;
}

export type ImportKind = "xlsx" | "csv" | "label_photo";
export interface ImportRowInput {
  row_no: number; barcode: string; name: string; brand: string; category: string;
  size: number | null; unit: string; price: number | null; offer_price: number | null; valid_until: string | null;
  product_id: string | null; action: "create" | "update" | "skip"; errors: string[]; warnings: string[];
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
  async saveItem({ product, marketId, price, updatedAt, offer, source }) {
    const { error } = await supabase.rpc("save_market_item_v2", {
      p_source: source ?? "manual",
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
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    fail(error);
    return path;
  },
  async removeImage(path) {
    await supabase.storage.from(IMAGE_BUCKET).remove([path]);
  },
  async resetDemo() {
    const c = demoCatalog;
    fail((await supabase.from("markets").upsert(c.markets.map((m) => ({ id: m.id, name: m.name, neighborhood: m.neighborhood, address: m.address, is_demo: true })))).error);
    fail((await supabase.from("products").upsert(c.products.map((p) => ({
      id: p.id, name: p.name, brand: p.brand, category: p.category, size: p.size, unit: p.unit, emoji: p.emoji, group_key: p.group, is_demo: true,
    })))).error);
    fail((await supabase.from("prices").upsert(c.prices.map((p) => ({ product_id: p.productId, market_id: p.marketId, price: p.price, updated_at: p.updatedAt })))).error);
    fail((await supabase.from("offers").upsert(c.offers.map((o) => ({ id: o.id, product_id: o.productId, market_id: o.marketId, price: o.price, valid_until: o.validUntil })), { onConflict: "product_id,market_id" })).error);
  },
  async createImportBatch(marketId, kind, fileName, rows) {
    const { data, error } = await supabase.from("import_batches")
      .insert({ market_id: marketId, kind, file_name: fileName, total: rows.length }).select("id").single();
    fail(error);
    const id = data!.id;
    for (let i = 0; i < rows.length; i += 500) {
      fail((await supabase.from("import_rows").insert(rows.slice(i, i + 500).map((r) => ({ ...r, batch_id: id })))).error);
    }
    return id;
  },
  async updateImportRow(id, patch) {
    fail((await supabase.from("import_rows").update(patch).eq("id", id)).error);
  },
  async publishBatch(batchId) {
    const { data, error } = await supabase.rpc("publish_import_batch", { p_batch_id: batchId });
    fail(error);
    return data ?? 0;
  },
  async discardBatch(batchId) {
    fail((await supabase.from("import_batches").update({ status: "discarded" }).eq("id", batchId)).error);
  },
  async setProductStatus(productId, status) {
    fail((await supabase.from("products").update({ status }).eq("id", productId)).error);
  },
  async removeProduct(productId) {
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (!error) return "deleted";
    if (error.code !== "23503") fail(error);
    fail((await supabase.from("products").update({ status: "rejected" }).eq("id", productId)).error);
    return "hidden";
  },
  async unlinkMember(userId, marketId) {
    fail((await supabase.from("market_members").delete().eq("user_id", userId).eq("market_id", marketId)).error);
  },
};

export const catalogRepo: CatalogRepository = cloudCatalogRepository;

export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const groupKey = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "-");
