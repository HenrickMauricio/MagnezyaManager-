/**
 * Motor de preço — núcleo puro (decisão D1: preço por dia como regra inicial,
 * com estratégia por artigo em `priceUnit`). Testado em tests/unit/pricing.test.ts.
 *
 * Valores em cêntimos (inteiros) e percentagens em pontos-base (2300 = 23 %).
 * Arredondamento ao cêntimo por linha (half-up); o IVA é calculado sobre a base
 * tributável de cada taxa, como no resumo do PDF (plano §4.3).
 *
 *   bruto da linha       = preço × quantidade × (dias, se POR_DIA)
 *   linha                = bruto − desconto da linha
 *   líquido da linha     = linha − desconto global (proporcional)
 *   serviços             = preço × quantidade (sem descontos)
 *   IVA por taxa         = Σ líquidos dessa taxa × taxa
 */

export type PriceUnit = "POR_DIA" | "POR_EVENTO";

export type PricedItem = {
  unitPriceCents: number;
  quantity: number;
  priceUnit: PriceUnit;
  billableDays: number;
  discountBp: number;
  taxRateBp: number;
};

export type PricedService = { unitPriceCents: number; quantity: number; taxRateBp: number };

export type TaxLine = { rateBp: number; baseCents: number; taxCents: number };

export type QuoteTotals = {
  /** Valor de cada linha de artigo depois do desconto da linha. */
  itemTotals: number[];
  serviceTotals: number[];
  /** Soma dos artigos sem qualquer desconto. */
  grossCents: number;
  /** Soma dos artigos depois dos descontos de linha. */
  subtotalCents: number;
  /** Desconto global aplicado aos artigos. */
  discountCents: number;
  servicesCents: number;
  taxLines: TaxLine[];
  taxCents: number;
  totalCents: number;
  /** Desconto efetivo total sobre os artigos (linha + global), em pontos-base. */
  effectiveDiscountBp: number;
};

/** Multiplica por uma fração em pontos-base, arredondando ao cêntimo (half-up). */
export function applyBp(cents: number, bp: number): number {
  return Math.round((cents * bp) / 10_000);
}

/** Dias faturáveis de um aluguer: do início ao fim do evento, inclusive (mínimo 1). */
export function billableDaysBetween(startISO: string, endISO: string): number {
  const ms = Date.parse(`${endISO}T00:00:00Z`) - Date.parse(`${startISO}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

export function itemGrossCents(item: Pick<PricedItem, "unitPriceCents" | "quantity" | "priceUnit" | "billableDays">): number {
  const days = item.priceUnit === "POR_DIA" ? Math.max(1, item.billableDays) : 1;
  return item.unitPriceCents * item.quantity * days;
}

export function computeTotals(items: PricedItem[], services: PricedService[], globalDiscountBp: number): QuoteTotals {
  const gross = items.map(itemGrossCents);
  const itemTotals = items.map((item, i) => gross[i]! - applyBp(gross[i]!, item.discountBp));
  const itemNet = itemTotals.map((total) => total - applyBp(total, globalDiscountBp));
  const serviceTotals = services.map((s) => s.unitPriceCents * s.quantity);

  const bases = new Map<number, number>();
  items.forEach((item, i) => bases.set(item.taxRateBp, (bases.get(item.taxRateBp) ?? 0) + itemNet[i]!));
  services.forEach((s, i) => bases.set(s.taxRateBp, (bases.get(s.taxRateBp) ?? 0) + serviceTotals[i]!));
  const taxLines = [...bases]
    .sort(([a], [b]) => b - a)
    .map(([rateBp, baseCents]) => ({ rateBp, baseCents, taxCents: applyBp(baseCents, rateBp) }));

  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const grossCents = sum(gross);
  const subtotalCents = sum(itemTotals);
  const netItems = sum(itemNet);
  const servicesCents = sum(serviceTotals);
  const taxCents = sum(taxLines.map((t) => t.taxCents));

  return {
    itemTotals,
    serviceTotals,
    grossCents,
    subtotalCents,
    discountCents: subtotalCents - netItems,
    servicesCents,
    taxLines,
    taxCents,
    totalCents: netItems + servicesCents + taxCents,
    effectiveDiscountBp: grossCents === 0 ? 0 : Math.round(((grossCents - netItems) * 10_000) / grossCents),
  };
}
