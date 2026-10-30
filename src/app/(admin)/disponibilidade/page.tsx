import type { Metadata } from "next";
import { CalendarRange } from "lucide-react";
import { z } from "zod";
import { requirePagePermission } from "@/server/auth/session";
import { getAvailabilityOverview } from "@/server/services/availability";
import { listCategoryOptions } from "@/server/services/categories";
import { AvailabilityValue } from "@/components/features/availability/availability-value";
import { ListFilters } from "@/components/list-filters";
import { PeriodFilter } from "@/components/period-filter";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Pagination, RowLink, Table, Td, Th, listHref, rowClass } from "@/components/ui/table";
import { formatInteger, formatISODate, todayISO } from "@/lib/format";
import { parsePeriod } from "@/lib/validation/period";

export const metadata: Metadata = { title: "Disponibilidade" };

const MAX_DAYS = 92;
const filtersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  categoria: z.string().trim().max(60).catch(""),
  apenas: z.enum(["todos", "falta"]).catch("todos"),
  pagina: z.coerce.number().int().min(1).max(1000).catch(1),
});

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePagePermission("availability:view");
  const raw = await searchParams;
  const today = todayISO();
  const { from, to } = parsePeriod(raw, today, { defaultDays: 7, maxDays: MAX_DAYS });
  const filters = filtersSchema.parse(raw);
  const [{ rows, total, page, pageSize }, categories] = await Promise.all([
    getAvailabilityOverview(user, { from, to, ...filters }),
    listCategoryOptions(user),
  ]);
  const period = `de=${from}&ate=${to}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Disponibilidade"
        description={`Unidades livres de cada artigo entre ${formatISODate(from)} e ${formatISODate(to)} — o valor é o mínimo do período.`}
      />

      <div className="space-y-3">
        <PeriodFilter from={from} to={to} today={today} maxDays={MAX_DAYS} />
        <ListFilters
          placeholder="Pesquisar artigo por nome ou SKU"
          filters={[
            {
              name: "categoria",
              label: "Categoria",
              defaultValue: "",
              options: [{ value: "", label: "Todas as categorias" }, ...categories.map((c) => ({ value: c.slug, label: c.name }))],
            },
            {
              name: "apenas",
              label: "Mostrar",
              defaultValue: "todos",
              options: [
                { value: "todos", label: "Todos os artigos" },
                { value: "falta", label: "Só esgotados" },
              ],
            },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<CalendarRange className="size-8" strokeWidth={1.5} />}
            title="Nenhum artigo encontrado"
            description={filters.apenas === "falta" ? "Nenhum artigo esgotado neste período." : "Experimente outra pesquisa ou outro filtro."}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Artigo</Th>
                  <Th>Categoria</Th>
                  <Th className="text-right">Stock</Th>
                  <Th className="text-right">Reservado (máx.)</Th>
                  <Th className="text-right">Manutenção (máx.)</Th>
                  <Th className="text-right">Disponível</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={rowClass}>
                    <Td>
                      <RowLink href={`/disponibilidade/${r.id}?${period}`}>{r.name}</RowLink>
                      <div className="tabular text-[12px] text-fg-subtle">{r.sku}</div>
                    </Td>
                    <Td className="text-fg-muted">{r.category.name}</Td>
                    <Td className="tabular text-right">{formatInteger(r.total)}</Td>
                    <Td className="tabular text-right text-fg-muted">{r.maxReserved ? formatInteger(r.maxReserved) : "—"}</Td>
                    <Td className="tabular text-right text-fg-muted">{r.maxMaintenance ? formatInteger(r.maxMaintenance) : "—"}</Td>
                    <Td className="text-right">
                      <AvailabilityValue available={r.minAvailable} total={r.total} />
                      {r.minAvailable < r.total && (
                        <div className="mt-1 text-[11px] text-fg-subtle">mín. a {formatISODate(r.minDate)}</div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              hrefFor={(p) => listHref("/disponibilidade", { de: from, ate: to, ...filters, pagina: p }, { q: "", categoria: "", apenas: "todos", pagina: 1 })}
            />
          </>
        )}
      </Card>
    </div>
  );
}
