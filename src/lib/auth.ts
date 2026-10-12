import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, user: session?.user ?? null, ready };
}

/** Roles and market memberships come from the database (never from the browser). */
export function useAccess() {
  const { user, ready } = useSession();
  const q = useQuery({
    queryKey: ["access", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [r, m] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
        supabase.from("market_members").select("market_id").eq("user_id", user!.id),
      ]);
      const roles = (r.data ?? []).map((x) => x.role);
      return { isAdmin: roles.includes("admin"), isMarket: roles.includes("market"), marketIds: (m.data ?? []).map((x) => x.market_id) };
    },
  });
  return { user, ready: ready && (!user || !q.isLoading), isAdmin: false, isMarket: false, marketIds: [] as string[], ...q.data };
}
