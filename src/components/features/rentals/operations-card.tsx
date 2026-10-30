import Link from "next/link";
import type { getOperationsSummary } from "@/server/services/rentals";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { RentalStatusBadge } from "@/components/features/rentals/rental-status";
import { dateOnlyToISO, formatInteger, formatISODate } from "@/lib/format";
import type { RentalStatus } from "@/lib/validation/rentals";

type Summary = Awaited<ReturnType<typeof getOperationsSummary>>;
type Row = Summary["deliveries"][number];

function Column({ title, empty, rows, dateOf, tone }: { title: string; empty: string; rows: Row[]; dateOf: (r: Row) => Date; tone?: "danger" }) {
  return (
    <div className="min-w-0">
      <h3 className="flex items-center gap-2 px-5 pt-4 text-[12px] font-semibold uppercase tracking-wide text-fg-muted">
        {title}
        {rows.length > 0 && <Badge tone={tone ?? "neutral"}>{rows.length}</Badge>}
      </h3>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-[14px] text-fg-subtle">{empty}</p>
      ) : (
        <ul className="py-2">
          {rows.map((r) => (
            <li key={r.id} className="relative px-5 py-2 hover:bg-surface-2/60">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/reservas/${r.id}`} className="truncate text-[14px] font-medium after:absolute after:inset-0">
                  {r.number} · {r.event.name}
                </Link>
                <span className="tabular shrink-0 text-[12px] text-fg-muted">{formatISODate(dateOnlyToISO(dateOf(r))).slice(0, 5)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[12px] text-fg-muted">
                <span className="truncate">{r.client.name}</span>
                <RentalStatusBadge status={r.status as RentalStatus} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Operação dos próximos 7 dias: entregas, devoluções e atrasos. */
export function OperationsCard({ data }: { data: Summary }) {
  return (
    <Card>
      <CardHeader
        title="Operação"
        description={`${formatInteger(data.unitsOut)} unidades com clientes neste momento`}
        action={
          <div className="flex flex-wrap gap-2">
            {data.conflicts > 0 && (
              <Link href="/reservas?estado=CONFLITO_STOCK">
                <Badge tone="danger">{data.conflicts} em conflito de stock</Badge>
              </Link>
            )}
            <Link href="/calendario" className="text-[13px] font-medium text-fg-muted hover:text-fg">
              Calendário
            </Link>
          </div>
        }
      />
      <div className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
        <Column title="Entregas (7 dias)" empty="Sem entregas previstas." rows={data.deliveries} dateOf={(r) => r.deliveryDate} />
        <Column title="Recolhas (7 dias)" empty="Sem recolhas previstas." rows={data.returns} dateOf={(r) => r.returnDate} />
        <Column title="Em atraso" empty="Nenhum aluguer em atraso." rows={data.overdue} dateOf={(r) => r.returnDate} tone="danger" />
      </div>
    </Card>
  );
}
