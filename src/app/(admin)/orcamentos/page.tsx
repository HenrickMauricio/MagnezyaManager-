import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { listQuotes } from "@/server/services/quotes";
import { QuoteStatusBadge } from "@/components/features/quotes/quote-status";
import { ListFilters } from "@/components/list-filters";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Pagination, RowLink, Table, Td, Th, listHref, rowClass } from "@/components/ui/table";
import { dateOnlyToISO, formatCents, formatISODate } from "@/lib/format";
import { QUOTE_STATUSES, quoteListSchema, type QuoteStatus } from "@/lib/validation/quotes";

export const metadata: Metadata = { title: "Orçamentos" };

const DEFAULTS = { q: "", estado: "abertos", autor: "todos", pagina: 1 };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePagePermission("quote:view");
  const params = quoteListSchema.parse(await searchParams);
  const { items, total, page, pageSize } = await listQuotes(user, params);
  const canCreate = user.permissions.has("quote:create");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Orçamentos"
        description="Propostas aos clientes, da preparação à aprovação."
        actions={
          canCreate && (
            <Link href="/orcamentos/novo" className={buttonClasses()}>
              <Plus className="size-4" /> Novo orçamento
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
            defaultValue: "abertos",
            options: [
              { value: "abertos", label: "Em aberto" },
              { value: "todos", label: "Todos" },
              ...(Object.entries(QUOTE_STATUSES) as [QuoteStatus, string][]).map(([value, label]) => ({ value, label })),
            ],
          },
          {
            name: "autor",
            label: "Autor",
            defaultValue: "todos",
            options: [
              { value: "todos", label: "Todos os vendedores" },
              { value: "meus", label: "Os meus" },
            ],
          },
        ]}
      />

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-8" strokeWidth={1.5} />}
            title="Sem orçamentos"
            description={params.estado === "abertos" ? "Não há orçamentos em aberto." : "Experimente outra pesquisa ou outro filtro."}
            action={
              canCreate && (
                <Link href="/orcamentos/novo" className={buttonClasses()}>
                  <Plus className="size-4" /> Novo orçamento
                </Link>
              )
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Orçamento</Th>
                  <Th>Cliente</Th>
                  <Th>Evento</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((q) => (
                  <tr key={q.id} className={rowClass}>
                    <Td>
                      <RowLink href={`/orcamentos/${q.id}`}>{q.number}</RowLink>
                      <div className="text-[12px] text-fg-subtle">
                        {q.createdBy.name}
                        {q.currentVersion > 0 && ` · v${q.currentVersion}`}
                      </div>
                    </Td>
                    <Td className="text-fg-muted">{q.client.name}</Td>
                    <Td className="text-fg-muted">
                      {q.event.name}
                      <div className="tabular text-[12px] text-fg-subtle">
                        {formatISODate(dateOnlyToISO(q.startDate))}
                        {q.endDate.getTime() !== q.startDate.getTime() && ` – ${formatISODate(dateOnlyToISO(q.endDate))}`}
                      </div>
                    </Td>
                    <Td className="tabular whitespace-nowrap text-right font-medium">{formatCents(q.totalCents)}</Td>
                    <Td>
                      <QuoteStatusBadge status={q.status as QuoteStatus} />
                      {q.status === "ENVIADO" && (
                        <div className="mt-1 text-[11px] text-fg-subtle">válido até {formatISODate(dateOnlyToISO(q.validUntil))}</div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} hrefFor={(p) => listHref("/orcamentos", { ...params, pagina: p }, DEFAULTS)} />
          </>
        )}
      </Card>
    </div>
  );
}
