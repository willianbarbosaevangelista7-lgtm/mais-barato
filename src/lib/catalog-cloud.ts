import { useMemo } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Catalog, PriceSource, ProductStatus, Unit } from "./types";

export const emptyCatalog: Catalog = { markets: [], products: [], prices: [], offers: [] };
export const IMAGE_BUCKET = "product-images";

/** Reads the shared catalog (public data) from Lovable Cloud. */
export async function fetchCatalog(): Promise<Catalog> {
  const [m, p, pr, o] = await Promise.all([
    supabase.from("markets").select("*").order("created_at"),
    supabase.from("products").select("*").order("created_at"),
    supabase.from("prices").select("*"),
    supabase.from("offers").select("*"),
  ]);
  const err = m.error ?? p.error ?? pr.error ?? o.error;
  if (err) throw new Error(err.message);
  return {
    markets: (m.data ?? []).map((x) => ({ id: x.id, name: x.name, neighborhood: x.neighborhood, address: x.address, isDemo: x.is_demo })),
    products: (p.data ?? []).map((x) => ({
      id: x.id, name: x.name, brand: x.brand, category: x.category, size: Number(x.size), unit: x.unit as Unit,
      emoji: x.emoji, group: x.group_key, barcode: x.barcode ?? undefined, imagePath: x.image_path ?? undefined, isDemo: x.is_demo,
      status: x.status as ProductStatus,
    })),
    prices: (pr.data ?? []).map((x) => ({ productId: x.product_id, marketId: x.market_id, price: Number(x.price), updatedAt: x.updated_at, recordedAt: x.recorded_at, source: x.source as PriceSource })),
    offers: (o.data ?? []).map((x) => ({ id: x.id, productId: x.product_id, marketId: x.market_id, price: Number(x.price), validUntil: x.valid_until })),
  };
}

export const catalogQuery = queryOptions({ queryKey: ["catalog"], queryFn: fetchCatalog, staleTime: 30_000 });

export function useCatalogQuery() {
  return useQuery(catalogQuery);
}

/** Consumers only see approved products (and their prices/offers). */
export function publicCatalog(c: Catalog): Catalog {
  const ok = new Set(c.products.filter((p) => (p.status ?? "approved") === "approved").map((p) => p.id));
  return {
    markets: c.markets,
    products: c.products.filter((p) => ok.has(p.id)),
    prices: c.prices.filter((p) => ok.has(p.productId)),
    offers: c.offers.filter((o) => ok.has(o.productId)),
  };
}

/** Same shape as before (Catalog), so search/compare/list logic stays unchanged. Approved products only. */
export function useCatalog(): Catalog {
  const data = useQuery(catalogQuery).data;
  return useMemo(() => (data ? publicCatalog(data) : emptyCatalog), [data]);
}

/** Full catalog including pending/rejected products — partner and admin areas only. */
export function useFullCatalog(): Catalog {
  return useQuery(catalogQuery).data ?? emptyCatalog;
}

export const SOURCE_LABEL: Record<PriceSource, string> = {
  manual: "digitado", scan: "leitura de código", import: "importação", label_photo: "foto de etiqueta", admin: "administrador",
};

/** Signed URL for a product photo (bucket is private; reads are allowed by storage policy). */
export function useImageUrl(path: string | undefined) {
  return useQuery({
    queryKey: ["img", path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(path!, 3600);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
  }).data;
}
