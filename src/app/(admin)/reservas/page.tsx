import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { listRentals } from "@/server/services/rentals";
import { RentalStatusBadge, isOverdue } from "@/components/features/rentals/rental-status";
import { ListFilters } from "@/components/list-filters";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Pagination, RowLink, Table, Td, Th, listHref, rowClass } from "@/components/ui/table";
import { dateOnlyToISO, formatInteger, formatISODate, todayISO } from "@/lib/format";
import { RENTAL_STATUSES, rentalListSchema, type RentalStatus } from "@/lib/validation/rentals";

export const metadata: Metadata = { title: "Reservas" };

const DEFAULTS = { q: "", estado: "ativas", pagina: 1 };

export default async function RentalsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePagePermission("rental:view");
  const params = rentalListSchema.parse(await searchParams);
  const { items, total, page, pageSize } = await listRentals(user, params);
  const today = todayISO();
  const canCreate = user.permissions.has("rental:manage");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Reservas"
        description="Material reservado, entregue e por devolver."
        actions={
          canCreate && (
            <Link href="/reservas/nova" className={buttonClasses()}>
              <Plus className="size-4" /> Nova reserva
            </Link>
          )
        }
      />

      <ListFilters
        placeholder="Pesquisar por número, cliente ou evento"
        filters={[
          {
            name: "estado",
            label: "Estado",
            defaultValue: "ativas",
            options: [
              { value: "ativas", label: "Em curso" },
              { value: "todas", label: "Todas" },
              ...(Object.entries(RENTAL_STATUSES) as [RentalStatus, string][]).map(([value, label]) => ({ value, label })),
            ],
          },
        ]}
      />

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={<Truck className="size-8" strokeWidth={1.5} />}
            title="Sem reservas"
            description={params.estado === "ativas" ? "Não há reservas em curso." : "Experimente outra pesquisa ou outro filtro."}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Reserva</Th>
                  <Th>Cliente</Th>
                  <Th>Entrega → recolha</Th>
                  <Th className="text-right">Unidades</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const returnISO = dateOnlyToISO(r.returnDate);
                  return (
                    <tr key={r.id} className={rowClass}>
                      <Td>
                        <RowLink href={`/reservas/${r.id}`}>{r.number}</RowLink>
                        <div className="text-[12px] text-fg-subtle">
                          {r.event.name}
                          {r.event.city && ` · ${r.event.city}`}
                        </div>
                      </Td>
                      <Td className="text-fg-muted">{r.client.name}</Td>
                      <Td className="tabular whitespace-nowrap text-fg-muted">
                        {formatISODate(dateOnlyToISO(r.deliveryDate))} → {formatISODate(returnISO)}
                      </Td>
                      <Td className="tabular text-right">
                        {formatInteger(r.items.reduce((s, i) => s + i.quantity, 0))}
                        <div className="text-[12px] text-fg-subtle">
                          {r._count.items} {r._count.items === 1 ? "artigo" : "artigos"}
                        </div>
                      </Td>
                      <Td>
                        <RentalStatusBadge status={r.status as RentalStatus} overdue={isOverdue(r.status, returnISO, today)} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              hrefFor={(p) => listHref("/reservas", { ...params, pagina: p }, DEFAULTS)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
