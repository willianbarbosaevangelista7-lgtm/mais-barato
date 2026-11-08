import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));

import { supabase } from "@/integrations/supabase/client";
import { CATALOG_STALE_TIME_MS, catalogQuery, fetchCatalog } from "@/lib/catalog-cloud";

describe("catalog network efficiency", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requests only fields used by the public and partner catalog", async () => {
    const selected: Array<{ table: string; columns: string }> = [];
    const data: Record<string, unknown[]> = {
      markets: [{ id: "m1", name: "Mercado", neighborhood: "Centro", address: "Rua A", is_demo: false }],
      products: [{ id: "p1", name: "Arroz", brand: "Marca", category: "Grãos", size: 1, unit: "kg", emoji: "🍚", group_key: "arroz", barcode: null, image_path: null, is_demo: false, status: "approved" }],
      prices: [{ product_id: "p1", market_id: "m1", price: 10, updated_at: "2026-11-08", recorded_at: "2026-11-08T10:00:00Z", source: "manual" }],
      offers: [{ id: "o1", product_id: "p1", market_id: "m1", price: 8, valid_until: "2026-11-10" }],
    };

    vi.mocked(supabase.from).mockImplementation(((table: string) => ({
      select: (columns: string) => {
        selected.push({ table, columns });
        return Promise.resolve({ data: data[table], error: null });
      },
    })) as never);

    const catalog = await fetchCatalog();

    expect(selected).toEqual([
      { table: "markets", columns: "id,name,neighborhood,address,is_demo" },
      { table: "products", columns: "id,name,brand,category,size,unit,emoji,group_key,barcode,image_path,is_demo,status" },
      { table: "prices", columns: "product_id,market_id,price,updated_at,recorded_at,source" },
      { table: "offers", columns: "id,product_id,market_id,price,valid_until" },
    ]);
    expect(selected.every(({ columns }) => columns !== "*")).toBe(true);
    expect(catalog.products[0]).toMatchObject({ id: "p1", status: "approved", imagePath: undefined });
    expect(catalog.prices[0]).toMatchObject({ productId: "p1", marketId: "m1", price: 10 });
  });

  it("uses a bounded two-minute catalog freshness window", () => {
    expect(CATALOG_STALE_TIME_MS).toBe(120_000);
    expect(catalogQuery.staleTime).toBe(CATALOG_STALE_TIME_MS);
    expect(catalogQuery.refetchOnWindowFocus).toBe(false);
  });
});
