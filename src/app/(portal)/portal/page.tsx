import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireClientPage } from "@/server/auth/session";
import { getPortalOverview } from "@/server/services/portal";
import { PORTAL_RENTAL_LABELS } from "@/components/features/portal/portal-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { dateOnlyToISO, formatCents, formatInteger, formatISODate } from "@/lib/format";

export const metadata: Metadata = { title: "Portal do cliente" };

export default async function PortalHome() {
  const user = await requireClientPage();
  const { client, pending, total, upcoming } = await getPortalOverview(user);
  const iso = (d: Date) => formatISODate(dateOnlyToISO(d));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[13px] font-medium text-fg-muted">{client.name}</p>
        <h1 className="mt-1 font-display text-[32px] font-semibold tracking-tight">Bem-vindo, {user.name.split(" ")[0]}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Propostas a aguardar a sua resposta" value={formatInteger(pending.length)} href="/portal/propostas" />
        <StatCard label="Propostas recebidas" value={formatInteger(total)} href="/portal/propostas" />
      </div>

      {pending.length > 0 && (
        <Card>
          <CardHeader title="A aguardar a sua resposta" description="Reveja e aprove para reservarmos o material." />
          <ul className="divide-y divide-border">
            {pending.map((q) => (
              <li key={q.id} className="relative flex items-center gap-3 px-5 py-4 hover:bg-surface-2/60">
                <div className="min-w-0 flex-1">
                  <Link href={`/portal/propostas/${q.id}`} className="font-medium after:absolute after:inset-0">
                    {q.number} · {q.event.name}
                  </Link>
                  <div className="text-[13px] text-fg-muted">
                    Evento a {iso(q.startDate)} · válida até {iso(q.validUntil)}
                  </div>
                </div>
                <span className="tabular shrink-0 font-medium">{q.versions[0] ? formatCents(q.versions[0].totalCents) : ""}</span>
                <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Próximos eventos"
          action={
            <Link href="/portal/reservas" className="text-[13px] font-medium text-fg-muted hover:text-fg">
              Ver reservas
            </Link>
          }
        />
        {upcoming.length === 0 ? (
          <p className="px-5 py-8 text-center text-[14px] text-fg-muted">Sem reservas futuras.</p>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{r.event.name}</div>
                  <div className="text-[13px] text-fg-muted">
                    {r.number} · entrega {iso(r.deliveryDate)} · recolha {iso(r.returnDate)}
                  </div>
                </div>
                <Badge tone={r.status === "CONFLITO_STOCK" ? "warning" : "neutral"}>{PORTAL_RENTAL_LABELS[r.status] ?? r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
