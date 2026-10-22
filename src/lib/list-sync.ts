import { supabase } from "@/integrations/supabase/client";
import { listStore } from "./store";
import type { ListItem } from "./types";

/** Keeps the browser list in sync with the signed-in account (table shopping_list_items, RLS: own rows only). */
let userId: string | null = null;
let pushing = false;
let last = "";

async function push() {
  if (!userId || pushing) return;
  const items = listStore.get();
  const snap = JSON.stringify(items);
  if (snap === last) return;
  pushing = true;
  try {
    const uid = userId;
    const ids = items.map((i) => i.productId);
    let del = supabase.from("shopping_list_items").delete().eq("user_id", uid);
    if (ids.length) del = del.not("product_id", "in", `(${ids.map((i) => `"${i}"`).join(",")})`);
    await del;
    if (items.length)
      await supabase.from("shopping_list_items").upsert(
        items.map((i) => ({ user_id: uid, product_id: i.productId, qty: i.qty, bought: i.bought, updated_at: new Date().toISOString() })),
      );
    last = snap;
  } finally {
    pushing = false;
    if (JSON.stringify(listStore.get()) !== last) void push();
  }
}

export function mergeLists(local: ListItem[], remote: ListItem[]): ListItem[] {
  const out = new Map(remote.map((i) => [i.productId, { ...i }]));
  for (const l of local) {
    const r = out.get(l.productId);
    out.set(l.productId, r ? { productId: l.productId, qty: Math.max(r.qty, l.qty), bought: r.bought && l.bought } : l);
  }
  return [...out.values()];
}

async function onSignedIn(uid: string) {
  if (userId === uid) return;
  userId = uid;
  last = "";
  const { data, error } = await supabase.from("shopping_list_items").select("product_id,qty,bought").eq("user_id", uid);
  if (error || userId !== uid) return;
  const remote = (data ?? []).map((r) => ({ productId: r.product_id, qty: r.qty, bought: r.bought }));
  listStore.set(mergeLists(listStore.get(), remote));
  await push();
}

let started = false;
export function startListSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  listStore.subscribe(() => void push());
  supabase.auth.getSession().then(({ data }) => data.session && onSignedIn(data.session.user.id));
  supabase.auth.onAuthStateChange((event, s) => {
    if (s?.user) void onSignedIn(s.user.id);
    else if (event === "SIGNED_OUT") {
      userId = null;
      last = "";
      listStore.set([]); // account list must not leak to the next person on this device
    }
  });
}
