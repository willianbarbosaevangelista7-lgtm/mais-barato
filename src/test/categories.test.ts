import { describe, expect, it } from "vitest";
import { categories, categorySectors } from "../lib/categories";

describe("catalog categories", () => {
  it("expands the catalog without removing existing categories", () => {
    expect(categories.length).toBeGreaterThan(6);
    expect(categories).toEqual(expect.arrayContaining(["Mercearia", "Laticínios", "Hortifrúti", "Limpeza", "Higiene", "Padaria"]));
  });

  it("assigns each category to one sector", () => {
    expect(categorySectors.length).toBeGreaterThan(1);
    expect(new Set(categories).size).toBe(categories.length);
    expect(categorySectors.every((sector) => sector.categories.length > 0)).toBe(true);
  });
});