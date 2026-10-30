import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownUp, Wrench } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { listMovements, listOpenMaintenances } from "@/server/services/inventory";
import { ListFilters } from "@/components/list-filters";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Pagination, Table, Td, Th, listHref } from "@/components/ui/table";
import { dateOnlyToISO, formatInteger, formatISODate, todayISO } from "@/lib/format";
import { MAINTENANCE_STATUSES, MOVEMENT_TYPES, movementListSchema } from "@/lib/validation/catalog";

export const metadata: Metadata = { title: "Inventário" };

const DEFAULTS = { q: "", tipo: "todos", pagina: 1 };
const MOVEMENT_TONE = { ENTRADA: "success", ABATE: "danger", AJUSTE: "info" } as const;
const signed = (n: number) => (n > 0 ? `+${formatInteger(n)}` : formatInteger(n));

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePagePermission("inventory:manage");
  const params = movementListSchema.parse(await searchParams);
  const [open, movements] = await Promise.all([listOpenMaintenances(user), listMovements(user, params)]);
  const today = todayISO();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Inventário"
        description="Manutenções em curso e histórico de movimentos de stock. Para registar, abra o artigo."
      />

      <Card className="overflow-hidden">
        <CardHeader
          title="Em manutenção"
          description={`${open.length} ${open.length === 1 ? "registo em aberto" : "registos em aberto"}`}
        />
        {open.length === 0 ? (
          <EmptyState icon={<Wrench className="size-8" strokeWidth={1.5} />} title="Nenhuma manutenção em aberto" />
        ) : (
          <ul className="divide-y divide-border">
            {open.map((m) => {
              const expected = m.expectedEndDate ? dateOnlyToISO(m.expectedEndDate) : null;
              const late = expected !== null && expected < today;
              return (
                <li key={m.id} className="relative flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2/60">
                  <div className="min-w-0">
                    <Link href={`/artigos/${m.article.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                      {m.article.name}
                    </Link>
                    <div className="text-[13px] text-fg-muted">
                      <span className="tabular">{m.article.sku}</span> · {formatInteger(m.quantity)} {m.article.unit} · {m.reason}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-fg-muted">
                    <span className="tabular">
                      desde {formatISODate(dateOnlyToISO(m.startDate))}
                      {expected && ` · previsão ${formatISODate(expected)}`}
                    </span>
                    {late && <Badge tone="danger">Atrasada</Badge>}
                    <Badge tone={m.status === "EM_CURSO" ? "info" : "warning"}>{MAINTENANCE_STATUSES[m.status]}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <section className="space-y-4">
        <h2 className="font-display text-[20px] font-semibold tracking-tight">Movimentos de stock</h2>
        <ListFilters
          placeholder="Pesquisar por artigo, SKU ou motivo"
          filters={[
            {
              name: "tipo",
              label: "Tipo",
              defaultValue: "todos",
              options: [
                { value: "todos", label: "Todos os tipos" },
                ...Object.entries(MOVEMENT_TYPES).map(([value, label]) => ({ value, label })),
              ],
            },
          ]}
        />
        <Card className="overflow-hidden">
          {movements.items.length === 0 ? (
            <EmptyState
              icon={<ArrowDownUp className="size-8" strokeWidth={1.5} />}
              title="Sem movimentos"
              description="Entradas, abates e ajustes registados nos artigos aparecem aqui."
            />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Data</Th>
                    <Th>Artigo</Th>
                    <Th>Tipo</Th>
                    <Th className="text-right">Quantidade</Th>
                    <Th>Motivo</Th>
                  </tr>
                </thead>
                <tbody>
                  {movements.items.map((m) => (
                    <tr key={m.id}>
                      <Td className="tabular whitespace-nowrap text-fg-muted">{formatISODate(dateOnlyToISO(m.effectiveDate))}</Td>
                      <Td>
                        <Link href={`/artigos/${m.article.id}`} className="font-medium hover:underline">
                          {m.article.name}
                        </Link>
                        <div className="tabular text-[12px] text-fg-subtle">{m.article.sku}</div>
                      </Td>
                      <Td>
                        <Badge tone={MOVEMENT_TONE[m.type]}>{MOVEMENT_TYPES[m.type]}</Badge>
                      </Td>
                      <Td className="tabular whitespace-nowrap text-right font-medium">
                        {signed(m.quantity)} <span className="font-normal text-fg-subtle">{m.article.unit}</span>
                      </Td>
                      <Td>
                        <div className="max-w-[320px] truncate" title={m.reason}>
                          {m.reason}
                        </div>
                        {m.user && <div className="text-[12px] text-fg-subtle">{m.user.name}</div>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination
                page={movements.page}
                pageSize={movements.pageSize}
                total={movements.total}
                hrefFor={(p) => listHref("/inventario", { ...params, pagina: p }, DEFAULTS)}
              />
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
