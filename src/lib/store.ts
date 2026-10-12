import { useSyncExternalStore } from "react";
import type { ListItem } from "./types";

// The catalog now lives in Lovable Cloud (see catalog-cloud.ts). The shopping list stays in this browser for now.
export { useCatalog } from "./catalog-cloud";

function createStore<T>(key: string, initial: T) {
  let state = initial;
  let loaded = false;
  const listeners = new Set<() => void>();
  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) state = JSON.parse(raw);
    } catch {
      /* ignore */
    }
  };
  return {
    get: () => (load(), state),
    getServer: () => initial,
    set(next: T | ((s: T) => T)) {
      load();
      state = typeof next === "function" ? (next as (s: T) => T)(state) : next;
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* ignore */
      }
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const listStore = createStore<ListItem[]>("maisbarato:list:v1", []);

export const useList = () =>
  useSyncExternalStore(listStore.subscribe, listStore.get, listStore.getServer);

export const listActions = {
  add(productId: string) {
    listStore.set((l) =>
      l.some((i) => i.productId === productId)
        ? l.map((i) => (i.productId === productId ? { ...i, qty: i.qty + 1 } : i))
        : [...l, { productId, qty: 1, bought: false }],
    );
  },
  remove: (productId: string) => listStore.set((l) => l.filter((i) => i.productId !== productId)),
  setQty: (productId: string, qty: number) =>
    listStore.set((l) => l.map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, qty) } : i))),
  toggle: (productId: string) =>
    listStore.set((l) => l.map((i) => (i.productId === productId ? { ...i, bought: !i.bought } : i))),
  clear: () => listStore.set([]),
};
