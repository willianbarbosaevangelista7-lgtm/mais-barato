import { Link } from "@tanstack/react-router";
import { Home, Search, Scale, ListChecks, Store, LogIn, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useList } from "@/lib/store";
import { useCatalogQuery } from "@/lib/catalog-cloud";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

function AccountButton() {
  const { user, ready } = useSession();
  if (!ready) return null;
  const cls = "inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted";
  return user ? (
    <button className={cls} onClick={() => supabase.auth.signOut()}><LogOut className="h-4 w-4" />Sair</button>
  ) : (
    <Link to="/auth" className={cls}><LogIn className="h-4 w-4" />Entrar</Link>
  );
}

function CatalogStatus() {
  const q = useCatalogQuery();
  if (q.isLoading) return <p className="mb-3 text-center text-sm text-muted-foreground">Carregando preços…</p>;
  if (q.isError)
    return (
      <p className="mb-3 rounded-xl border border-destructive p-3 text-sm text-destructive">
        Não foi possível carregar os preços. Verifique sua conexão.{" "}
        <button className="font-semibold underline" onClick={() => q.refetch()}>Tentar de novo</button>
      </p>
    );
  return null;
}

const nav = [
  { to: "/", label: "Início", icon: Home },
  { to: "/busca", label: "Buscar", icon: Search },
  { to: "/comparar", label: "Comparar", icon: Scale },
  { to: "/lista", label: "Lista", icon: ListChecks },
  { to: "/supermercados", label: "Mercados", icon: Store },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const list = useList();
  const count = list.filter((i) => !i.bought).length;
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-extrabold text-primary-deep">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">M</span>
            Mais<span className="-ml-2 text-success">Barato</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
                activeProps={{ className: "bg-secondary text-secondary-foreground" }}
              >
                {n.label}
                {n.to === "/lista" && count > 0 && ` (${count})`}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="bg-warning px-4 py-1.5 text-center text-xs font-medium text-warning-foreground">
        Versão de teste: mercados, preços e ofertas são <strong>fictícios</strong>, apenas para demonstração.
      </div>
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/" }}
            className="relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-muted-foreground"
            activeProps={{ className: "text-primary" }}
          >
            <n.icon className="h-5 w-5" aria-hidden />
            {n.label}
            {n.to === "/lista" && count > 0 && (
              <span className="absolute right-[22%] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] text-accent-foreground">
                {count}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-extrabold text-primary-deep">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
