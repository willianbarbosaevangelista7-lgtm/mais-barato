import { describe, expect, it } from "vitest";
import { parsePhotoResult, photoInputSchema } from "../lib/photo-search";

describe("photo search", () => {
  it("extracts a product query without treating identification as a catalog match", () => {
    expect(parsePhotoResult('{"query":" arroz ","label":"Arroz 1 kg"}')).toEqual({ query: "arroz", label: "Arroz 1 kg" });
  });
  it("preserves an unrecognized photo as an empty query", () => {
    expect(parsePhotoResult('{"query":"","label":""}').query).toBe("");
  });
  it("rejects external image URLs and oversized inputs", () => {
    expect(photoInputSchema.safeParse({ image: "https://example.com/photo.jpg" }).success).toBe(false);
    expect(photoInputSchema.safeParse({ image: "data:image/jpeg;base64," + "A".repeat(750_000) }).success).toBe(false);
    expect(photoInputSchema.safeParse({ image: "data:image/jpeg;base64,/9j/" }).success).toBe(true);
  });
});