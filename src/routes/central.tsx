import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useAccess } from "@/lib/auth";
import { useFullCatalog } from "@/lib/catalog-cloud";
import { QuickPrice } from "@/components/central/QuickPrice";
import { ImportCenter } from "@/components/central/ImportCenter";
import { AdminApprovals } from "@/components/central/AdminApprovals";
import { Reports } from "@/components/central/Reports";
import { AdminPanel } from "@/components/AdminPanel";
import { Card, btn, field } from "@/components/central/ui";

export const Route = createFileRoute("/central")({
  head: () => ({
    meta: [
      { title: "Central de cadastro — MaisBarato" },
      { name: "description", content: "Supermercados parceiros atualizam preços por código de barras, planilha ou foto de etiqueta, com revisão antes de publicar." },
      { property: "og:title", content: "Central de cadastro de produtos e preços — MaisBarato" },
      { property: "og:description", content: "Cadastro único por EAN, importação Excel/CSV, histórico de preços e relatórios para supermercados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Central,
});

type Tab = "rapido" | "importar" | "aprovar" | "contas" | "relatorios";

function Central() {
  const access = useAccess();
  const catalog = useFullCatalog();
  const [tab, setTab] = useState<Tab>("rapido");
  const [marketId, setMarketId] = useState("");
  const markets = access.isAdmin ? catalog.markets : catalog.markets.filter((m) => access.marketIds.includes(m.id));
  const market = markets.find((m) => m.id === marketId) ?? markets[0];
  const title = <PageTitle title="Central de cadastro" subtitle="Atualize preços sem duplicar produtos. Importações só aparecem para os clientes depois de revisadas e publicadas." />;

  if (!access.ready) return <AppShell>{title}<p className="text-sm text-muted-foreground">Verificando acesso…</p></AppShell>;
  if (!access.user || (!access.isAdmin && !markets.length))
    return (
      <AppShell>{title}
        <Card title="Área exclusiva de supermercados parceiros">
          <p className="mb-3 text-sm text-muted-foreground">
            {access.user ? "Sua conta ainda não está ligada a um supermercado. Peça ao administrador do MaisBarato." : "Entre com a conta do seu supermercado."}
          </p>
          {!access.user && <Link to="/auth" className={`${btn} grid place-items-center`}>Entrar</Link>}
        </Card>
      </AppShell>
    );

  const tabs: [Tab, string][] = [["rapido", "Preço rápido"], ["importar", "Importar e fotos"], ["relatorios", "Relatórios"]];
  if (access.isAdmin) tabs.splice(2, 0, ["aprovar", "Aprovações"], ["contas", "Contas"]);

  return (
    <AppShell>
      {title}
      <div className="mb-3 space-y-2">
        <select aria-label="Supermercado" className={field} value={market?.id} onChange={(e) => setMarketId(e.target.value)}>
          {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {tabs.map(([k, l]) => (
            <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}
              className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{l}</button>
          ))}
        </div>
      </div>
      {market && tab === "rapido" && <Card title="Atualizar preço por código de barras" desc="Escaneie ou digite o EAN; o produto existente é reaproveitado e o preço fica com data, horário e origem."><QuickPrice catalog={catalog} market={market} /></Card>}
      {market && tab === "importar" && <Card title="Importação em massa e fotos de etiqueta" desc="Envie uma planilha ou fotografe uma etiqueta. As linhas ficam em revisão até você publicar."><ImportCenter catalog={catalog} market={market} /></Card>}
      {tab === "aprovar" && access.isAdmin && <Card title="Aprovar, editar e remover cadastros" desc="Produtos novos criados por supermercados só aparecem para os clientes depois de aprovados."><AdminApprovals catalog={catalog} /></Card>}
      {tab === "contas" && access.isAdmin && <AdminPanel markets={catalog.markets} />}
      {tab === "relatorios" && <Card title="Relatórios"><Reports catalog={catalog} marketIds={access.isAdmin ? catalog.markets.map((m) => m.id) : markets.map((m) => m.id)} /></Card>}
    </AppShell>
  );
}
