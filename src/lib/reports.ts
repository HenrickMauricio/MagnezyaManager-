/**
 * Cálculos dos relatórios (módulo puro, sem acesso à BD).
 *
 * Faturação = valor sem IVA das propostas aprovadas pelo cliente cuja reserva
 * não foi cancelada. É uma faturação de gestão, não fiscal: o sistema não
 * emite faturas (ver PLANO-TECNICO §6, R4).
 *
 * Mês de referência ("base"):
 * - "evento"    → mês de início do evento (quando o serviço é prestado);
 * - "aprovacao" → mês em que o cliente aprovou (vendas fechadas).
 */
import { applyBp } from "@/lib/pricing";

export const REVENUE_BASES = { evento: "Mês do evento", aprovacao: "Mês da aprovação" } as const;
export type RevenueBasis = keyof typeof REVENUE_BASES;

export const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;
export const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export type RevenueItem = { articleId: string; name: string; quantity: number; lineTotalCents: number };

export type RevenueQuote = {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  sellerId: string;
  sellerName: string;
  /** Início do evento, "aaaa-mm-dd". */
  eventStart: string;
  /** Dia da aprovação em Lisboa, "aaaa-mm-dd". */
  approvedOn: string;
  /** Desconto global (bp), repartido pelos artigos como no motor de preço. */
  discountBp: number;
  netCents: number;
  taxCents: number;
  totalCents: number;
  servicesCents: number;
  items: RevenueItem[];
  /** A reserva foi cancelada depois da aprovação: não conta como faturação. */
  rentalCancelled: boolean;
};

export type MonthRow = {
  month: number; // 1–12
  count: number;
  netCents: number;
  taxCents: number;
  totalCents: number;
  /** Parte do valor sem IVA de eventos já iniciados / ainda por realizar. */
  pastNetCents: number;
  futureNetCents: number;
};

export function referenceDate(q: Pick<RevenueQuote, "eventStart" | "approvedOn">, basis: RevenueBasis): string {
  return basis === "evento" ? q.eventStart : q.approvedOn;
}

/** Propostas que contam como faturação no ano indicado. */
export function revenueQuotes<T extends RevenueQuote>(quotes: T[], year: number, basis: RevenueBasis): T[] {
  return quotes.filter((q) => !q.rentalCancelled && referenceDate(q, basis).startsWith(`${year}-`));
}

/** Faturação mês a mês (12 linhas, meses sem vendas a zero). */
export function monthlyRevenue(quotes: RevenueQuote[], year: number, basis: RevenueBasis, today: string): MonthRow[] {
  const rows: MonthRow[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    count: 0,
    netCents: 0,
    taxCents: 0,
    totalCents: 0,
    pastNetCents: 0,
    futureNetCents: 0,
  }));
  for (const q of revenueQuotes(quotes, year, basis)) {
    const row = rows[Number(referenceDate(q, basis).slice(5, 7)) - 1]!;
    row.count++;
    row.netCents += q.netCents;
    row.taxCents += q.taxCents;
    row.totalCents += q.totalCents;
    if (q.eventStart <= today) row.pastNetCents += q.netCents;
    else row.futureNetCents += q.netCents;
  }
  return rows;
}

export type RevenueSummary = { count: number; netCents: number; taxCents: number; totalCents: number; futureNetCents: number };

export function summarize(rows: MonthRow[], upToMonth = 12): RevenueSummary {
  const s: RevenueSummary = { count: 0, netCents: 0, taxCents: 0, totalCents: 0, futureNetCents: 0 };
  for (const r of rows.slice(0, upToMonth)) {
    s.count += r.count;
    s.netCents += r.netCents;
    s.taxCents += r.taxCents;
    s.totalCents += r.totalCents;
    s.futureNetCents += r.futureNetCents;
  }
  return s;
}

/** Variação relativa em bp (null se não houver base de comparação). */
export function changeBp(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) * 10_000) / previous);
}

export type ClientRow = { clientId: string; name: string; count: number; netCents: number };

export function revenueByClient(quotes: RevenueQuote[]): ClientRow[] {
  const map = new Map<string, ClientRow>();
  for (const q of quotes) {
    const row = map.get(q.clientId) ?? { clientId: q.clientId, name: q.clientName, count: 0, netCents: 0 };
    row.count++;
    row.netCents += q.netCents;
    map.set(q.clientId, row);
  }
  return [...map.values()].sort((a, b) => b.netCents - a.netCents || a.name.localeCompare(b.name, "pt"));
}

export type ArticleRow = { articleId: string; name: string; quantity: number; quotes: number; netCents: number };

/**
 * Valor por artigo: total da linha menos a sua parte do desconto global
 * (a mesma repartição de `computeTotals`). Os serviços somam-se à parte.
 */
export function revenueByArticle(quotes: RevenueQuote[]): { articles: ArticleRow[]; servicesCents: number } {
  const map = new Map<string, ArticleRow & { seen: string }>();
  let servicesCents = 0;
  for (const q of quotes) {
    servicesCents += q.servicesCents;
    for (const item of q.items) {
      const row = map.get(item.articleId) ?? { articleId: item.articleId, name: item.name, quantity: 0, quotes: 0, netCents: 0, seen: "" };
      row.quantity += item.quantity;
      row.netCents += item.lineTotalCents - applyBp(item.lineTotalCents, q.discountBp);
      if (row.seen !== q.id) {
        row.quotes++;
        row.seen = q.id;
      }
      map.set(item.articleId, row);
    }
  }
  const articles = [...map.values()].map(({ seen: _seen, ...row }) => row);
  return { articles: articles.sort((a, b) => b.netCents - a.netCents || a.name.localeCompare(b.name, "pt")), servicesCents };
}

// ---------------------------------------------------------------------------
// Desempenho comercial: propostas emitidas pela primeira vez no ano e o seu desfecho.
// ---------------------------------------------------------------------------

export type ProposalOutcome = "aprovada" | "recusada" | "expirada" | "cancelada" | "em_aberto";

export type IssuedProposal = {
  sellerId: string;
  sellerName: string;
  status: string;
  validUntil: string;
  netCents: number;
  rentalCancelled: boolean;
};

export function proposalOutcome(p: Pick<IssuedProposal, "status" | "validUntil" | "rentalCancelled">, today: string): ProposalOutcome {
  switch (p.status) {
    case "APROVADO":
      return p.rentalCancelled ? "cancelada" : "aprovada";
    case "REJEITADO":
      return "recusada";
    case "EXPIRADO":
      return "expirada";
    case "CANCELADO":
      return "cancelada";
    case "ENVIADO":
      // A expiração é marcada quando o orçamento volta a ser aberto; aqui conta já.
      return p.validUntil < today ? "expirada" : "em_aberto";
    default:
      return "em_aberto"; // em revisão ou a aguardar aprovação interna
  }
}

export type SellerRow = {
  sellerId: string;
  name: string;
  issued: number;
  approved: number;
  rejected: number;
  lost: number; // expiradas + canceladas
  open: number;
  approvedNetCents: number;
  /** Aprovadas ÷ decididas (aprovadas, recusadas, expiradas e canceladas), em bp; null sem decisões. */
  conversionBp: number | null;
};

export function sellerPerformance(proposals: IssuedProposal[], today: string): SellerRow[] {
  const map = new Map<string, SellerRow>();
  for (const p of proposals) {
    const row =
      map.get(p.sellerId) ??
      ({ sellerId: p.sellerId, name: p.sellerName, issued: 0, approved: 0, rejected: 0, lost: 0, open: 0, approvedNetCents: 0, conversionBp: null } as SellerRow);
    row.issued++;
    const outcome = proposalOutcome(p, today);
    if (outcome === "aprovada") {
      row.approved++;
      row.approvedNetCents += p.netCents;
    } else if (outcome === "recusada") row.rejected++;
    else if (outcome === "em_aberto") row.open++;
    else row.lost++;
    map.set(p.sellerId, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, conversionBp: conversion(r) }))
    .sort((a, b) => b.approvedNetCents - a.approvedNetCents || a.name.localeCompare(b.name, "pt"));
}

export function conversion(r: Pick<SellerRow, "approved" | "rejected" | "lost">): number | null {
  const decided = r.approved + r.rejected + r.lost;
  return decided === 0 ? null : Math.round((r.approved * 10_000) / decided);
}

/** Marcas "redondas" do eixo (0 incluído), em cêntimos: 1, 2 ou 5 × 10^n euros. */
export function niceTicks(maxCents: number, target = 4): number[] {
  if (maxCents <= 0) return [0];
  const rough = maxCents / 100 / target;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, Math.round([1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough)! * 100));
  const ticks: number[] = [];
  for (let v = 0; v < maxCents + step; v += step) ticks.push(v);
  return ticks;
}

/** "1234,56" — números para o Excel em português (vírgula decimal, sem separador de milhares). */
const csvEuros = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/** CSV da faturação mensal (separador ";", como o Excel em pt-PT espera). */
export function monthlyRevenueCsv(months: MonthRow[], previousMonths: MonthRow[], year: number, basis: RevenueBasis): string {
  const header = ["Mês", "Propostas aprovadas", "Sem IVA (€)", "IVA (€)", "Com IVA (€)", `${year - 1} sem IVA (€)`];
  const rows = months.map((m, i) => [
    `${MONTH_NAMES[i]} ${year}`,
    String(m.count),
    csvEuros(m.netCents),
    csvEuros(m.taxCents),
    csvEuros(m.totalCents),
    csvEuros(previousMonths[i]?.netCents ?? 0),
  ]);
  const total = summarize(months);
  rows.push([
    "Total",
    String(total.count),
    csvEuros(total.netCents),
    csvEuros(total.taxCents),
    csvEuros(total.totalCents),
    csvEuros(summarize(previousMonths).netCents),
  ]);
  const note = [`Faturação de gestão (propostas aprovadas), por ${REVENUE_BASES[basis].toLowerCase()}. Não é um documento fiscal.`];
  return [header, ...rows, [], note].map((r) => r.join(";")).join("\r\n") + "\r\n";
}
