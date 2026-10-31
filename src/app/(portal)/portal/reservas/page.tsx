import type { Metadata } from "next";
import Link from "next/link";
import { Truck } from "lucide-react";
import { requireClientPage } from "@/server/auth/session";
import { listPortalRentals } from "@/server/services/portal";
import { PORTAL_RENTAL_LABELS } from "@/components/features/portal/portal-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { dateOnlyToISO, formatInteger, formatISODate } from "@/lib/format";

export const metadata: Metadata = { title: "Reservas" };

export default async function PortalRentalsPage() {
  const user = await requireClientPage();
  const rentals = await listPortalRentals(user);
  const iso = (d: Date) => formatISODate(dateOnlyToISO(d));

  return (
    <div className="space-y-6">
      <PageHeader title="Reservas" description="Material reservado para os seus eventos." />
      {rentals.length === 0 ? (
        <Card>
          <EmptyState icon={<Truck className="size-8" strokeWidth={1.5} />} title="Ainda não tem reservas" description="As reservas aparecem aqui depois de aprovar uma proposta." />
        </Card>
      ) : (
        rentals.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-display text-[16px] font-semibold tracking-tight">{r.event.name}</h2>
                <p className="text-[13px] text-fg-muted">
                  {r.number}
                  {[r.event.venue, r.event.city].filter(Boolean).length > 0 && ` · ${[r.event.venue, r.event.city].filter(Boolean).join(", ")}`}
                  {r.quote && (
                    <>
                      {" · "}
                      <Link href={`/portal/propostas/${r.quote.id}`} className="underline underline-offset-2">
                        proposta {r.quote.number}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <Badge tone={r.status === "CONFLITO_STOCK" ? "warning" : r.status === "DEVOLVIDO" ? "success" : "info"}>
                {PORTAL_RENTAL_LABELS[r.status] ?? r.status}
              </Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-[14px] sm:grid-cols-4">
              <div>
                <dt className="text-fg-muted">Entrega</dt>
                <dd className="font-medium">{iso(r.deliveryDate)}</dd>
              </div>
              <div>
                <dt className="text-fg-muted">Início</dt>
                <dd className="font-medium">{iso(r.startDate)}</dd>
              </div>
              <div>
                <dt className="text-fg-muted">Fim</dt>
                <dd className="font-medium">{iso(r.endDate)}</dd>
              </div>
              <div>
                <dt className="text-fg-muted">Recolha</dt>
                <dd className="font-medium">{iso(r.returnDate)}</dd>
              </div>
            </dl>
            <ul className="divide-y divide-border border-t border-border text-[14px]">
              {r.items.map((i, index) => (
                <li key={index} className="flex justify-between gap-3 px-5 py-2.5">
                  <span>{i.article.name}</span>
                  <span className="tabular text-fg-muted">
                    {formatInteger(i.quantity)} {i.article.unit}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
