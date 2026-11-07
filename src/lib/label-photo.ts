import { z } from "zod";

export const labelResultSchema = z.object({
  ean: z.string().max(20), name: z.string().max(120), brand: z.string().max(80),
  size: z.number().min(0).max(100000), unit: z.string().max(5),
  price: z.number().min(0).max(100000), offer_price: z.number().min(0).max(100000), valid_until: z.string().max(10),
});

/** Converts the AI answer to a spreadsheet-like row so it goes through the same validation as imports. */
export function parseLabelResult(text: string) {
  const r = labelResultSchema.parse(JSON.parse(text));
  return {
    ean: r.ean.replace(/\D/g, ""), nome: r.name.trim(), marca: r.brand.trim(),
    tamanho: r.size || "", unidade: r.unit, preco: r.price || "",
    preco_oferta: r.offer_price || "", validade_oferta: /^\d{4}-\d{2}-\d{2}$/.test(r.valid_until) ? r.valid_until : "",
    categoria: "",
  };
}
