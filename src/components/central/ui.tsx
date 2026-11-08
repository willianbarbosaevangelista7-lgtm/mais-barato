import type { ReactNode } from "react";

export const field = "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm";
export const btn = "h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary-deep";
export const btn2 = "h-11 w-full rounded-xl border border-border font-semibold hover:bg-muted";

export function Card({ title, children, desc }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <h2 className="mb-1 font-extrabold text-primary-deep">{title}</h2>
      {desc && <p className="mb-3 text-xs text-muted-foreground">{desc}</p>}
      {children}
    </section>
  );
}

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
