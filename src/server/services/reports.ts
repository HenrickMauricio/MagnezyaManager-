import "server-only";
import { prisma } from "@/server/db";
import { assertPermission, type CurrentUser } from "@/server/auth/session";
import { dateOnlyToISO, todayISO } from "@/lib/format";
import {
  changeBp,
  monthlyRevenue,
  referenceDate,
  revenueByArticle,
  revenueByClient,
  revenueQuotes,
  sellerPerformance,
  summarize,
  type IssuedProposal,
  type RevenueBasis,
  type RevenueQuote,
} from "@/lib/reports";

/**
 * Início do ano em Lisboa. Em janeiro Lisboa está em UTC+0, por isso a
 * meia-noite local coincide com a meia-noite UTC.
 */
const yearStart = (year: number) => new Date(`${year}-01-01T00:00:00.000Z`);

/** Propostas aprovadas com evento ou aprovação entre `from` e `to` (anos, inclusive). */
async function loadApprovedQuotes(from: number, to: number): Promise<RevenueQuote[]> {
  const rows = await prisma.quote.findMany({
    where: {
      status: "APROVADO",
      OR: [
        { startDate: { gte: yearStart(from), lt: yearStart(to + 1) } },
        { approvedAt: { gte: yearStart(from), lt: yearStart(to + 1) } },
      ],
    },
    select: {
      id: true,
      number: true,
      clientId: true,
      client: { select: { name: true } },
      createdById: true,
      createdBy: { select: { name: true } },
      startDate: true,
      approvedAt: true,
      discountBp: true,
      servicesCents: true,
      taxCents: true,
      totalCents: true,
      rental: { select: { status: true } },
      items: { select: { articleId: true, quantity: true, lineTotalCents: true, article: { select: { name: true } } } },
    },
  });
  return rows.map((q) => ({
    id: q.id,
    number: q.number,
    clientId: q.clientId,
    clientName: q.client.name,
    sellerId: q.createdById,
    sellerName: q.createdBy.name,
    eventStart: dateOnlyToISO(q.startDate),
    // approvedAt existe sempre em APROVADO; o fallback só protege dados antigos.
    approvedOn: todayISO(q.approvedAt ?? q.startDate),
    discountBp: q.discountBp,
    netCents: q.totalCents - q.taxCents,
    taxCents: q.taxCents,
    totalCents: q.totalCents,
    servicesCents: q.servicesCents,
    rentalCancelled: q.rental?.status === "CANCELADO",
    items: q.items.map((i) => ({ articleId: i.articleId, name: i.article.name, quantity: i.quantity, lineTotalCents: i.lineTotalCents })),
  }));
}

/** Anos com propostas emitidas, sempre incluindo o ano atual. */
async function availableYears(currentYear: number): Promise<number[]> {
  const range = await prisma.quote.aggregate({ where: { currentVersion: { gt: 0 } }, _min: { startDate: true }, _max: { startDate: true } });
  const first = Math.min(currentYear, range._min.startDate?.getUTCFullYear() ?? currentYear);
  const last = Math.max(currentYear, range._max.startDate?.getUTCFullYear() ?? currentYear);
  return Array.from({ length: last - first + 1 }, (_, i) => last - i);
}

export async function getRevenueReport(user: CurrentUser, { year, basis }: { year: number; basis: RevenueBasis }) {
  assertPermission(user, "report:view");
  const today = todayISO();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));

  const [approved, years] = await Promise.all([loadApprovedQuotes(year - 1, year), availableYears(currentYear)]);

  const months = monthlyRevenue(approved, year, basis, today);
  const previousMonths = monthlyRevenue(approved, year - 1, basis, today);
  const summary = summarize(months);
  // No ano em curso compara o mesmo período (janeiro → mês atual) do ano anterior.
  const toDate = year === currentYear ? currentMonth : 12;
  const comparison = {
    months: toDate,
    currentNetCents: summarize(months, toDate).netCents,
    previousNetCents: summarize(previousMonths, toDate).netCents,
    changeBp: changeBp(summarize(months, toDate).netCents, summarize(previousMonths, toDate).netCents),
  };

  const inYear = revenueQuotes(approved, year, basis);
  const clients = revenueByClient(inYear);
  const { articles, servicesCents } = revenueByArticle(inYear);
  const cancelled = approved.filter((q) => q.rentalCancelled && referenceDate(q, basis).startsWith(`${year}-`));

  return {
    year,
    basis,
    years,
    today,
    months,
    previousMonths,
    summary,
    comparison,
    averageNetCents: summary.count ? Math.round(summary.netCents / summary.count) : 0,
    clients: clients.slice(0, 10),
    clientCount: clients.length,
    articles: articles.slice(0, 10),
    servicesCents,
    cancelled: { count: cancelled.length, netCents: cancelled.reduce((s, q) => s + q.netCents, 0) },
  };
}

/** Desempenho por vendedor: propostas emitidas pela primeira vez no ano e o seu desfecho. */
export async function getSalesReport(user: CurrentUser, year: number) {
  assertPermission(user, "report:view");
  const today = todayISO();
  const rows = await prisma.quote.findMany({
    where: { versions: { some: { versionNumber: 1, issuedAt: { gte: yearStart(year), lt: yearStart(year + 1) } } } },
    select: {
      status: true,
      validUntil: true,
      totalCents: true,
      taxCents: true,
      createdById: true,
      createdBy: { select: { name: true } },
      rental: { select: { status: true } },
    },
  });
  const proposals: IssuedProposal[] = rows.map((q) => ({
    sellerId: q.createdById,
    sellerName: q.createdBy.name,
    status: q.status,
    validUntil: dateOnlyToISO(q.validUntil),
    netCents: q.totalCents - q.taxCents,
    rentalCancelled: q.rental?.status === "CANCELADO",
  }));
  const sellers = sellerPerformance(proposals, today);
  const totals = sellers.reduce(
    (t, s) => ({
      issued: t.issued + s.issued,
      approved: t.approved + s.approved,
      rejected: t.rejected + s.rejected,
      lost: t.lost + s.lost,
      open: t.open + s.open,
      approvedNetCents: t.approvedNetCents + s.approvedNetCents,
    }),
    { issued: 0, approved: 0, rejected: 0, lost: 0, open: 0, approvedNetCents: 0 },
  );
  return { sellers, totals };
}

/** Reservas diretas (sem orçamento) do ano: ocupam stock mas não têm valor associado. */
export async function countDirectRentals(user: CurrentUser, year: number) {
  assertPermission(user, "report:view");
  return prisma.rental.count({
    where: { quoteId: null, status: { not: "CANCELADO" }, startDate: { gte: yearStart(year), lt: yearStart(year + 1) } },
  });
}
