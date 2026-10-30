import type { Metadata } from "next";
import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { getRental } from "@/server/services/rentals";
import { orNotFound } from "@/server/page-helpers";
import { RentalActions } from "@/components/features/rentals/rental-actions";
import { RentalStatusBadge, isOverdue } from "@/components/features/rentals/rental-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DetailList, PageHeader } from "@/components/ui/page";
import { Table, Td, Th } from "@/components/ui/table";
import { addDaysISO, dateOnlyToISO, formatDateTime, formatInteger, formatISODate, todayISO } from "@/lib/format";
import type { RentalStatus } from "@/lib/validation/rentals";

export const metadata: Metadata = { title: "Reserva" };

type ReturnLine = { rentalItemId: string; returned: number; damaged: number };

export default async function RentalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("rental:view");
  const r = await orNotFound(getRental(user, id));
  const today = todayISO();
  const status = r.status as RentalStatus;
  const iso = (d: Date) => formatISODate(dateOnlyToISO(d));
  const returnISO = dateOnlyToISO(r.returnDate);
  const canManage = user.permissions.has("rental:manage");
  const canSeeClient = user.permissions.has("client:view");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        back={{ href: "/reservas", label: "Reservas" }}
        eyebrow={<RentalStatusBadge status={status} overdue={isOverdue(status, returnISO, today)} />}
        title={`${r.number} · ${r.event.name}`}
        description={
          <>
            {canSeeClient ? (
              <Link href={`/clientes/${r.client.id}`} className="underline underline-offset-2 hover:text-fg">
                {r.client.name}
              </Link>
            ) : (
              r.client.name
            )}
            {r.quote ? ` · orçamento ${r.quote.number}` : " · reserva direta"}
          </>
        }
        actions={
          canManage && (
            <RentalActions
              rentalId={r.id}
              number={r.number}
              status={status}
              today={today}
              items={r.items.map((i) => ({
                id: i.id,
                name: i.article.name,
                unit: i.article.unit,
                pending: i.quantity - i.quantityReturned,
              }))}
            />
          )
        }
      />

      {status === "CONFLITO_STOCK" && (
        <div role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-[14px] text-danger">
          Esta reserva excede o stock disponível. Resolva o conflito (reforçar stock, ajustar ou cancelar outra reserva) antes da entrega.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader title="Artigos" />
          <Table className="min-w-[520px]">
            <thead>
              <tr>
                <Th>Artigo</Th>
                <Th className="text-right">Quantidade</Th>
                <Th className="text-right">Devolvidas</Th>
                <Th className="text-right">Danificadas</Th>
                <Th>Ocupa stock até</Th>
              </tr>
            </thead>
            <tbody>
              {r.items.map((i) => (
                <tr key={i.id}>
                  <Td>
                    <Link href={`/disponibilidade/${i.article.id}?de=${dateOnlyToISO(r.deliveryDate)}&ate=${addDaysISO(dateOnlyToISO(i.blockTo), 2)}`} className="font-medium hover:underline">
                      {i.article.name}
                    </Link>
                    <div className="tabular text-[12px] text-fg-subtle">{i.article.sku}</div>
                  </Td>
                  <Td className="tabular text-right">
                    {formatInteger(i.quantity)} <span className="text-fg-subtle">{i.article.unit}</span>
                  </Td>
                  <Td className="tabular text-right text-fg-muted">{formatInteger(i.quantityReturned)}</Td>
                  <Td className="tabular text-right text-fg-muted">{i.quantityDamaged ? formatInteger(i.quantityDamaged) : "—"}</Td>
                  <Td className="tabular whitespace-nowrap text-fg-muted">
                    {iso(i.blockTo)}
                    {i.prepBufferDays > 0 && <div className="text-[12px] text-fg-subtle">+{i.prepBufferDays} d preparação</div>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Datas" />
            <DetailList
              className="sm:grid-cols-2"
              items={[
                { label: "Entrega", value: iso(r.deliveryDate) },
                { label: "Recolha", value: iso(r.returnDate) },
                { label: "Evento", value: `${iso(r.startDate)} – ${iso(r.endDate)}`, wide: true },
                { label: "Entregue a", value: r.actualDeliveryDate ? iso(r.actualDeliveryDate) : null },
                { label: "Devolvido a", value: r.actualReturnDate ? iso(r.actualReturnDate) : null },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="Evento" />
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "Local", value: [r.event.venue, r.event.city].filter(Boolean).join(", ") || null },
                { label: "Notas", value: r.notes },
              ]}
            />
            <div className="border-t border-border px-5 py-3 text-[12px] text-fg-subtle">
              Criada a {formatDateTime(r.createdAt)}
              {r.createdBy && ` por ${r.createdBy.name}`}
            </div>
          </Card>
        </div>
      </div>

      {r.returns.length > 0 && (
        <Card>
          <CardHeader title="Devoluções" />
          <ul className="divide-y divide-border">
            {r.returns.map((ret) => {
              const lines = ret.lines as ReturnLine[];
              return (
                <li key={ret.id} className="px-5 py-3 text-[14px]">
                  <div className="font-medium">
                    {iso(ret.returnedAt)}
                    {ret.receivedBy && <span className="font-normal text-fg-muted"> · recebido por {ret.receivedBy.name}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {lines.map((l) => {
                      const item = r.items.find((i) => i.id === l.rentalItemId);
                      return (
                        <Badge key={l.rentalItemId}>
                          {item?.article.name}: {l.returned}
                          {l.damaged > 0 && ` (${l.damaged} danificadas)`}
                        </Badge>
                      );
                    })}
                  </div>
                  {ret.notes && <p className="mt-1 text-[13px] text-fg-muted">{ret.notes}</p>}
                </li>
              );
            })}
          </ul>
          {r.maintenances.length > 0 && user.permissions.has("article:view") && (
            <p className="border-t border-border px-5 py-3 text-[13px] text-fg-muted">
              {r.maintenances.length} {r.maintenances.length === 1 ? "registo" : "registos"} de manutenção criados por danos —
              ver na ficha de cada artigo ou em{" "}
              <Link href="/inventario" className="underline underline-offset-2">
                Inventário
              </Link>
              .
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
