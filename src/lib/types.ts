// Domain types. Kept independent of storage so a database can replace the local store later.
export type Unit = "kg" | "g" | "L" | "ml" | "un";

export interface Market {
  id: string;
  name: string;
  neighborhood: string;
  address: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  size: number;
  unit: Unit;
  emoji: string;
  /** Products in the same group are equivalent (e.g. "arroz-branco") and compared by unit price. */
  group: string;
}

export interface Price {
  productId: string;
  marketId: string;
  price: number;
  updatedAt: string; // ISO date
}

export interface Offer {
  id: string;
  productId: string;
  marketId: string;
  price: number;
  validUntil: string; // YYYY-MM-DD
}

export interface Catalog {
  markets: Market[];
  products: Product[];
  prices: Price[];
  offers: Offer[];
}

export interface ListItem {
  productId: string;
  qty: number;
  bought: boolean;
}
