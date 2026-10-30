/**
 * Regras de stock que não dependem da base de dados.
 * Módulo puro, testado em tests/unit/inventory.test.ts.
 *
 * Stock total num dia = stock inicial + Σ movimentos com data ≤ esse dia.
 * Unidades em manutenção num dia = Σ manutenções que cobrem esse dia.
 * Datas no formato "aaaa-mm-dd" (comparáveis como texto).
 *
 * Convenção das manutenções: `end` é o último dia em que as unidades estão
 * fora de serviço. Uma manutenção fechada a D (reparada ou abatida) ocupa até
 * D−1: nesse dia as unidades voltam ao stock ou saem pelo movimento de abate.
 */

export type StockMovement = { date: string; quantity: number };
export type MaintenancePeriod = { start: string; end: string | null; quantity: number };

export function totalAt(initial: number, movements: readonly StockMovement[], date: string): number {
  let total = initial;
  for (const m of movements) if (m.date <= date) total += m.quantity;
  return total;
}

export function maintenanceAt(periods: readonly MaintenancePeriod[], date: string): number {
  let units = 0;
  for (const p of periods) if (p.start <= date && (p.end === null || p.end >= date)) units += p.quantity;
  return units;
}

export type StockShortage = { date: string; total: number; inMaintenance: number };

/**
 * Primeiro dia em que o stock fica negativo ou não chega para as unidades em
 * manutenção; null se nunca acontece. Basta verificar os dias em que algo
 * muda (datas dos movimentos e inícios de manutenção).
 */
export function findShortage(
  initial: number,
  movements: readonly StockMovement[],
  periods: readonly MaintenancePeriod[],
): StockShortage | null {
  const days = [...new Set([...movements.map((m) => m.date), ...periods.map((p) => p.start)])].sort();
  for (const date of days) {
    const total = totalAt(initial, movements, date);
    const inMaintenance = maintenanceAt(periods, date);
    if (total < 0 || inMaintenance > total) return { date, total, inMaintenance };
  }
  return null;
}

/** Quantidade com sinal de um movimento, a partir do tipo e da quantidade introduzida. */
export function signedQuantity(type: "ENTRADA" | "ABATE" | "AJUSTE", quantity: number): number {
  if (type === "ENTRADA") return Math.abs(quantity);
  if (type === "ABATE") return -Math.abs(quantity);
  return quantity; // AJUSTE: o sinal é o indicado
}

/** Próximo SKU automático: prefixo + número com 4 dígitos (CAD-0001). */
export function formatSku(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}
