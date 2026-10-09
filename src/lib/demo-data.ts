import type { Catalog, Price } from "./types";

// ATENÇÃO: todos os dados abaixo são FICTÍCIOS, criados apenas para demonstração.
export const demoCatalog: Catalog = {
  markets: [
    { id: "m1", name: "Mercado Exemplo Ipê", area: "Zona Norte (fictício)" },
    { id: "m2", name: "Supermercado Demo Jacarandá", area: "Zona Norte (fictício)" },
    { id: "m3", name: "Atacado Teste Cantareira", area: "Zona Norte (fictício)" },
    { id: "m4", name: "Mercadinho Modelo Tucuruvi", area: "Zona Norte (fictício)" },
  ],
  products: [
    { id: "p1", name: "Arroz branco tipo 1", brand: "Grão Bom", category: "Mercearia", size: 5, unit: "kg", emoji: "🍚", group: "arroz" },
    { id: "p2", name: "Arroz branco tipo 1", brand: "Campo Real", category: "Mercearia", size: 1, unit: "kg", emoji: "🍚", group: "arroz" },
    { id: "p3", name: "Feijão carioca", brand: "Sabor da Terra", category: "Mercearia", size: 1, unit: "kg", emoji: "🫘", group: "feijao" },
    { id: "p4", name: "Feijão carioca", brand: "Campo Real", category: "Mercearia", size: 2, unit: "kg", emoji: "🫘", group: "feijao" },
    { id: "p5", name: "Óleo de soja", brand: "Dourado", category: "Mercearia", size: 900, unit: "ml", emoji: "🫗", group: "oleo" },
    { id: "p6", name: "Café torrado e moído", brand: "Serra Alta", category: "Mercearia", size: 500, unit: "g", emoji: "☕", group: "cafe" },
    { id: "p7", name: "Açúcar refinado", brand: "Doce Vida", category: "Mercearia", size: 1, unit: "kg", emoji: "🧂", group: "acucar" },
    { id: "p8", name: "Leite integral UHT", brand: "Fazenda Feliz", category: "Laticínios", size: 1, unit: "L", emoji: "🥛", group: "leite" },
    { id: "p9", name: "Leite integral UHT", brand: "Vale Verde", category: "Laticínios", size: 1, unit: "L", emoji: "🥛", group: "leite" },
    { id: "p10", name: "Queijo muçarela fatiado", brand: "Fazenda Feliz", category: "Laticínios", size: 150, unit: "g", emoji: "🧀", group: "mucarela" },
    { id: "p11", name: "Banana prata", brand: "Hortifrúti", category: "Hortifrúti", size: 1, unit: "kg", emoji: "🍌", group: "banana" },
    { id: "p12", name: "Tomate", brand: "Hortifrúti", category: "Hortifrúti", size: 1, unit: "kg", emoji: "🍅", group: "tomate" },
    { id: "p13", name: "Detergente líquido", brand: "Brilho", category: "Limpeza", size: 500, unit: "ml", emoji: "🧴", group: "detergente" },
    { id: "p14", name: "Papel higiênico folha dupla (12 rolos)", brand: "Macio", category: "Higiene", size: 12, unit: "un", emoji: "🧻", group: "papel" },
    { id: "p15", name: "Pão de forma", brand: "Padaria Sol", category: "Padaria", size: 500, unit: "g", emoji: "🍞", group: "pao-forma" },
  ],
  prices: [],
  offers: [],
};

// Fictitious prices: [productId, m1, m2, m3, m4] (null = not sold there)
const table: [string, ...(number | null)[]][] = [
  ["p1", 27.9, 25.49, 23.9, 28.99],
  ["p2", 6.49, 5.99, null, 6.89],
  ["p3", 8.99, 7.89, 7.49, 9.29],
  ["p4", 16.9, 15.99, 14.29, null],
  ["p5", 7.49, 6.99, 6.59, 7.99],
  ["p6", 18.9, 19.49, 16.99, 20.5],
  ["p7", 4.99, 4.59, 4.29, 5.19],
  ["p8", 5.29, 4.99, 4.69, 5.49],
  ["p9", 4.89, 5.19, null, 4.99],
  ["p10", 9.9, 8.79, 8.49, 10.49],
  ["p11", 6.99, 7.49, 5.99, 6.49],
  ["p12", 8.49, 7.99, 7.29, 8.99],
  ["p13", 2.49, 2.29, 1.99, 2.79],
  ["p14", 21.9, 19.9, 18.49, 22.9],
  ["p15", 8.99, 7.99, null, 8.49],
];
const dates = ["2026-10-07", "2026-10-08", "2026-10-06", "2026-10-09"];
const ids = ["m1", "m2", "m3", "m4"];
demoCatalog.prices = table.flatMap(([productId, ...vals]) =>
  vals
    .map((v, i): Price | null =>
      v == null ? null : { productId, marketId: ids[i], price: v, updatedAt: dates[i] },
    )
    .filter((p): p is Price => p !== null),
);

demoCatalog.offers = [
  { id: "o1", productId: "p6", marketId: "m2", price: 15.99, validUntil: "2026-12-31" },
  { id: "o2", productId: "p8", marketId: "m4", price: 4.39, validUntil: "2026-12-31" },
  { id: "o3", productId: "p11", marketId: "m1", price: 4.99, validUntil: "2026-12-31" },
];

export const categories = ["Mercearia", "Laticínios", "Hortifrúti", "Limpeza", "Higiene", "Padaria"];
