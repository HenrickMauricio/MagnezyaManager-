import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CalendarClock, Download, Percent, Receipt } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { countDirectRentals, getRevenueReport, getSalesReport } from "@/server/services/reports";
import { MonthlyRevenueChart, MonthlyRevenueLegend } from "@/components/features/reports/monthly-chart";
import { ListFilters } from "@/components/list-filters";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Table, Td, Th } from "@/components/ui/table";
import { formatBasisPoints, formatCents, formatInteger, todayISO } from "@/lib/format";
import { MONTH_LABELS, MONTH_NAMES, REVENUE_BASES, changeBp, conversion } from "@/lib/reports";
import { reportParamsSchema } from "@/lib/validation/reports";

export const metadata: Metadata = { title: "Relatórios" };

const iconProps = { className: "size-[18px]", strokeWidth: 1.75 } as const;

/** 1250 → "+12,5 %"; null → "—". */
function formatChange(bp: number | null): string {
  if (bp === null) return "—";
  return `${bp > 0 ? "+" : bp < 0 ? "−" : ""}${formatBasisPoints(Math.abs(bp))}`;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePagePermission("report:view");
  const today = todayISO();
  const currentYear = Number(today.slice(0, 4));
  const { ano: year, base: basis } = reportParamsSchema(currentYear).parse(await searchParams);
  const [revenue, sales, directRentals] = await Promise.all([
    getRevenueReport(user, { year, basis }),
    getSalesReport(user, year),
    countDirectRentals(user, year),
  ]);
  const { months, previousMonths, summary, comparison } = revenue;
  const hasFuture = months.some((m) => m.futureNetCents > 0);
  const hasPast = months.some((m) => m.pastNetCents > 0);
  const canSeeClients = user.permissions.has("client:view");
  const canSeeArticles = user.permissions.has("article:view");
  const previousTotal = previousMonths.reduce((s, m) => s + m.netCents, 0);
  const salesConversion = conversion(sales.totals);
  // No ano em curso, compara com o mesmo período do ano anterior (ex.: "jan–out 2025").
  const comparisonPeriod = comparison.months === 12 ? `${year - 1}` : `jan–${MONTH_LABELS[comparison.months - 1]} ${year - 1}`;
  const csvHref = `/api/relatorios/faturacao?ano=${year}&base=${basis}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Relatórios"
        description="Faturação e desempenho comercial, a partir das propostas aprovadas pelos clientes."
        actions={
          <a href={csvHref} className={buttonClasses({ variant: "secondary" })}>
            <Download className="size-4" /> Exportar CSV
          </a>
        }
      />

      <ListFilters
        filters={[
          {
            name: "ano",
            label: "Ano",
            defaultValue: String(currentYear),
            options: revenue.years.map((y) => ({ value: String(y), label: String(y) })),
          },
          {
            name: "base",
            label: "Faturação por",
            defaultValue: "evento",
            options: Object.entries(REVENUE_BASES).map(([value, label]) => ({ value, label })),
          },
        ]}
      />

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Faturação ${year} (sem IVA)`}
          value={formatCents(summary.netCents)}
          hint={
            comparison.changeBp === null
              ? `Sem faturação em ${comparisonPeriod} para comparar`
              : `${formatChange(comparison.changeBp)} face a ${comparisonPeriod}`
          }
          icon={<Receipt {...iconProps} />}
        />
        <StatCard
          label="Propostas aprovadas"
          value={formatInteger(summary.count)}
          hint={summary.count ? `Valor médio ${formatCents(revenue.averageNetCents)}` : "Nenhuma no período"}
          icon={<BarChart3 {...iconProps} />}
        />
        <StatCard
          label="Taxa de conversão"
          value={salesConversion === null ? "—" : formatBasisPoints(salesConversion)}
          hint={
            salesConversion === null
              ? `Nenhuma proposta de ${year} com resposta`
              : `${formatInteger(sales.totals.approved)} de ${formatInteger(sales.totals.approved + sales.totals.rejected + sales.totals.lost)} propostas emitidas em ${year} com desfecho`
          }
          icon={<Percent {...iconProps} />}
        />
        <StatCard
          label="Eventos futuros"
          value={formatCents(summary.futureNetCents)}
          hint="Já aprovados, ainda por realizar (sem IVA)"
          icon={<CalendarClock {...iconProps} />}
        />
      </section>

      <Card className="overflow-hidden">
        <CardHeader
          title={`Faturação mensal ${year}`}
          description={`Valor sem IVA das propostas aprovadas, pelo ${REVENUE_BASES[basis].toLowerCase()}.`}
          action={hasFuture && hasPast ? <div className="hidden sm:block"><MonthlyRevenueLegend /></div> : undefined}
        />
        {summary.count === 0 ? (
          <EmptyState
            icon={<BarChart3 className="size-8" strokeWidth={1.5} />}
            title={`Sem faturação em ${year}`}
            description="A faturação conta as propostas aprovadas pelos clientes (no portal ou registadas pela equipa)."
          />
        ) : (
          <>
            {hasFuture && hasPast && (
              <div className="px-4 pt-4 sm:hidden">
                <MonthlyRevenueLegend />
              </div>
            )}
            <MonthlyRevenueChart months={months} highlightMonth={year === currentYear ? Number(today.slice(5, 7)) : undefined} />
            <Table className="min-w-[680px]">
              <thead>
                <tr>
                  <Th>Mês</Th>
                  <Th className="text-right">Propostas</Th>
                  <Th className="text-right">Sem IVA</Th>
                  <Th className="text-right">IVA</Th>
                  <Th className="text-right">Com IVA</Th>
                  <Th className="text-right">{year - 1} sem IVA</Th>
                  <Th className="text-right">Variação</Th>
                </tr>
              </thead>
              <tbody>
                {months.map((m, i) => (
                  <tr key={m.month} className={m.count === 0 ? "text-fg-subtle" : undefined}>
                    <Td className="py-2.5 capitalize">{MONTH_NAMES[i]}</Td>
                    <Td className="tabular py-2.5 text-right">{m.count ? formatInteger(m.count) : "—"}</Td>
                    <Td className="tabular py-2.5 text-right font-medium">{m.count ? formatCents(m.netCents) : "—"}</Td>
                    <Td className="tabular py-2.5 text-right text-fg-muted">{m.count ? formatCents(m.taxCents) : "—"}</Td>
                    <Td className="tabular py-2.5 text-right text-fg-muted">{m.count ? formatCents(m.totalCents) : "—"}</Td>
                    <Td className="tabular py-2.5 text-right text-fg-muted">
                      {previousMonths[i]!.count ? formatCents(previousMonths[i]!.netCents) : "—"}
                    </Td>
                    <Td className="tabular py-2.5 text-right text-fg-muted">{formatChange(changeBp(m.netCents, previousMonths[i]!.netCents))}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <Td className="border-b-0">Total</Td>
                  <Td className="tabular border-b-0 text-right">{formatInteger(summary.count)}</Td>
                  <Td className="tabular border-b-0 text-right">{formatCents(summary.netCents)}</Td>
                  <Td className="tabular border-b-0 text-right">{formatCents(summary.taxCents)}</Td>
                  <Td className="tabular border-b-0 text-right">{formatCents(summary.totalCents)}</Td>
                  <Td className="tabular border-b-0 text-right">{previousTotal ? formatCents(previousTotal) : "—"}</Td>
                  <Td className="tabular border-b-0 text-right">{formatChange(changeBp(summary.netCents, previousTotal))}</Td>
                </tr>
              </tfoot>
            </Table>
          </>
        )}
        <ul className="space-y-1 border-t border-border px-5 py-3 text-[12px] text-fg-subtle">
          <li>
            Faturação de gestão, a partir das propostas aprovadas — não substitui o programa de faturação certificado.
          </li>
          {revenue.cancelled.count > 0 && (
            <li>
              Não inclui {formatInteger(revenue.cancelled.count)} {revenue.cancelled.count === 1 ? "proposta aprovada" : "propostas aprovadas"} com a
              reserva cancelada depois ({formatCents(revenue.cancelled.netCents)} sem IVA).
            </li>
          )}
          {directRentals > 0 && (
            <li>
              {formatInteger(directRentals)} {directRentals === 1 ? "reserva direta" : "reservas diretas"} (sem orçamento) em {year} não{" "}
              {directRentals === 1 ? "tem" : "têm"} valor associado.
            </li>
          )}
        </ul>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader
            title="Clientes"
            description={
              revenue.clientCount > 10 ? `Os 10 com maior faturação, de ${formatInteger(revenue.clientCount)}` : "Faturação por cliente no período"
            }
          />
          {revenue.clients.length === 0 ? (
            <p className="px-5 py-6 text-[14px] text-fg-muted">Sem faturação no período.</p>
          ) : (
            <Table className="min-w-[420px]">
              <thead>
                <tr>
                  <Th>Cliente</Th>
                  <Th className="text-right">Propostas</Th>
                  <Th className="text-right">Sem IVA</Th>
                  <Th className="w-[120px]">Peso</Th>
                </tr>
              </thead>
              <tbody>
                {revenue.clients.map((c) => {
                  const share = summary.netCents ? Math.round((c.netCents * 10_000) / summary.netCents) : 0;
                  return (
                    <tr key={c.clientId}>
                      <Td className="py-2.5 font-medium">
                        {canSeeClients ? (
                          <Link href={`/clientes/${c.clientId}`} className="hover:underline">
                            {c.name}
                          </Link>
                        ) : (
                          c.name
                        )}
                      </Td>
                      <Td className="tabular py-2.5 text-right text-fg-muted">{formatInteger(c.count)}</Td>
                      <Td className="tabular py-2.5 text-right">{formatCents(c.netCents)}</Td>
                      <Td className="py-2.5">
                        <ShareBar bp={share} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Artigos" description="Os 10 com maior faturação (já com descontos)" />
          {revenue.articles.length === 0 ? (
            <p className="px-5 py-6 text-[14px] text-fg-muted">Sem faturação no período.</p>
          ) : (
            <>
              <Table className="min-w-[420px]">
                <thead>
                  <tr>
                    <Th>Artigo</Th>
                    <Th className="text-right">Unidades</Th>
                    <Th className="text-right">Propostas</Th>
                    <Th className="text-right">Sem IVA</Th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.articles.map((a) => (
                    <tr key={a.articleId}>
                      <Td className="py-2.5 font-medium">
                        {canSeeArticles ? (
                          <Link href={`/artigos/${a.articleId}`} className="hover:underline">
                            {a.name}
                          </Link>
                        ) : (
                          a.name
                        )}
                      </Td>
                      <Td className="tabular py-2.5 text-right text-fg-muted">{formatInteger(a.quantity)}</Td>
                      <Td className="tabular py-2.5 text-right text-fg-muted">{formatInteger(a.quotes)}</Td>
                      <Td className="tabular py-2.5 text-right">{formatCents(a.netCents)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {revenue.servicesCents > 0 && (
                <p className="px-5 py-3 text-[12px] text-fg-subtle">
                  Serviços adicionais (transporte, montagem…): {formatCents(revenue.servicesCents)} sem IVA.
                </p>
              )}
            </>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Desempenho por vendedor"
          description={`Propostas emitidas pela primeira vez em ${year} e o seu desfecho (o valor aprovado conta pela data de emissão).`}
        />
        {sales.sellers.length === 0 ? (
          <p className="px-5 py-6 text-[14px] text-fg-muted">Nenhuma proposta emitida em {year}.</p>
        ) : (
          <Table className="min-w-[760px]">
            <thead>
              <tr>
                <Th>Vendedor</Th>
                <Th className="text-right">Emitidas</Th>
                <Th className="text-right">Aprovadas</Th>
                <Th className="text-right">Recusadas</Th>
                <Th className="text-right">Expiradas / canceladas</Th>
                <Th className="text-right">Em aberto</Th>
                <Th className="text-right">Conversão</Th>
                <Th className="text-right">Valor aprovado</Th>
              </tr>
            </thead>
            <tbody>
              {sales.sellers.map((s) => (
                <tr key={s.sellerId}>
                  <Td className="py-2.5 font-medium">{s.name}</Td>
                  <Td className="tabular py-2.5 text-right">{formatInteger(s.issued)}</Td>
                  <Td className="tabular py-2.5 text-right">{formatInteger(s.approved)}</Td>
                  <Td className="tabular py-2.5 text-right text-fg-muted">{formatInteger(s.rejected)}</Td>
                  <Td className="tabular py-2.5 text-right text-fg-muted">{formatInteger(s.lost)}</Td>
                  <Td className="tabular py-2.5 text-right text-fg-muted">{formatInteger(s.open)}</Td>
                  <Td className="tabular py-2.5 text-right">{s.conversionBp === null ? "—" : formatBasisPoints(s.conversionBp)}</Td>
                  <Td className="tabular py-2.5 text-right font-medium">{formatCents(s.approvedNetCents)}</Td>
                </tr>
              ))}
            </tbody>
            {sales.sellers.length > 1 && (
              <tfoot>
                <tr className="font-semibold">
                  <Td className="border-b-0">Total</Td>
                  <Td className="tabular border-b-0 text-right">{formatInteger(sales.totals.issued)}</Td>
                  <Td className="tabular border-b-0 text-right">{formatInteger(sales.totals.approved)}</Td>
                  <Td className="tabular border-b-0 text-right">{formatInteger(sales.totals.rejected)}</Td>
                  <Td className="tabular border-b-0 text-right">{formatInteger(sales.totals.lost)}</Td>
                  <Td className="tabular border-b-0 text-right">{formatInteger(sales.totals.open)}</Td>
                  <Td className="tabular border-b-0 text-right">{salesConversion === null ? "—" : formatBasisPoints(salesConversion)}</Td>
                  <Td className="tabular border-b-0 text-right">{formatCents(sales.totals.approvedNetCents)}</Td>
                </tr>
              </tfoot>
            )}
          </Table>
        )}
      </Card>
    </div>
  );
}

/** Barra fina com o peso no total (o número fica ao lado; a cor nunca é a única pista). */
function ShareBar({ bp }: { bp: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.min(100, bp / 100)}%` }} />
      </div>
      <span className="tabular w-10 text-right text-[12px] text-fg-muted">{formatBasisPoints(bp)}</span>
    </div>
  );
}
