import { describe, expect, it } from "vitest";
import { parseDate, validateRows } from "@/lib/import";
import { parseLabelResult } from "@/lib/label-photo";
import type { Catalog } from "@/lib/types";

const catalog: Catalog = {
  markets: [{ id: "m1", name: "A", neighborhood: "x", address: "" }],
  products: [{ id: "p1", name: "Arroz", brand: "X", category: "Arroz e grãos", size: 5, unit: "kg", emoji: "", group: "arroz", barcode: "7891234567895" }],
  prices: [{ productId: "p1", marketId: "m1", price: 20, updatedAt: "2026-01-01" }],
  offers: [],
};
const today = "2026-11-06";
const v = (rows: Record<string, unknown>[]) => validateRows(rows, catalog, "m1", today);

describe("import validation", () => {
  it("existing EAN updates the price instead of creating a duplicate product", () => {
    const [r] = v([{ EAN: "7891234567895", Preço: "21,50" }]);
    expect(r!.action).toBe("update");
    expect(r!.product_id).toBe("p1");
    expect(r!.price).toBe(21.5);
    expect(r!.errors).toEqual([]);
  });
  it("rejects an invalid EAN check digit", () => {
    expect(v([{ ean: "7891234567890", preco: "5" }])[0]!.errors.join()).toMatch(/dígito/);
  });
  it("rejects zero or missing price", () => {
    expect(v([{ ean: "7891234567895", preco: "0" }])[0]!.errors).toContain("Preço inválido ou ausente.");
    expect(v([{ ean: "7891234567895" }])[0]!.errors).toContain("Preço inválido ou ausente.");
  });
  it("rejects offer not cheaper than normal price and expired offers", () => {
    expect(v([{ ean: "7891234567895", preco: "10", preco_oferta: "10", validade_oferta: "10/12/2026" }])[0]!.errors.join()).toMatch(/menor/);
    expect(v([{ ean: "7891234567895", preco: "10", preco_oferta: "8", validade_oferta: "01/11/2026" }])[0]!.errors.join()).toMatch(/passou/);
  });
  it("flags duplicate EANs within the same file", () => {
    const rows = v([{ ean: "7891234567895", preco: "10" }, { ean: "7891234567895", preco: "11" }]);
    expect(rows[1]!.errors.join()).toMatch(/repetido na linha 2/);
  });
  it("new products need name, category, size and unit", () => {
    const [r] = v([{ ean: "", nome: "Feijão", categoria: "Feijão e leguminosas", tamanho: "1", unidade: "kg", preco: "8,99" }]);
    expect(r!.action).toBe("create");
    expect(r!.errors).toEqual([]);
    expect(v([{ nome: "Feijão", preco: "8" }])[0]!.errors.length).toBeGreaterThan(0);
  });
  it("warns about price changes above 50%", () => {
    expect(v([{ ean: "7891234567895", preco: "40" }])[0]!.warnings.join()).toMatch(/Variação/);
  });
  it("parses Brazilian dates", () => {
    expect(parseDate("05/12/2026")).toBe("2026-12-05");
  });
  it("label photo result becomes a reviewable row", () => {
    const row = parseLabelResult(JSON.stringify({ ean: "789 1234567895", name: "Arroz", brand: "X", size: 5, unit: "kg", price: 19.9, offer_price: 0, valid_until: "" }));
    const [r] = v([row]);
    expect(r!.action).toBe("update");
    expect(r!.price).toBe(19.9);
  });
});
