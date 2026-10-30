/**
 * Motor de disponibilidade — núcleo puro (sem base de dados).
 * Testado em tests/unit/availability.test.ts.
 *
 * Princípios (plano §3):
 *  - a disponibilidade nunca é guardada: calcula-se por artigo e por dia;
 *  - granularidade diária, datas inclusivas "aaaa-mm-dd" (fuso de Lisboa);
 *  - disponível(dia) = stock total(dia) − reservado(dia) − manutenção(dia);
 *  - disponível(período) = mínimo dos dias do período.
 */
import { addDaysISO } from "@/lib/format";
import { totalAt, type StockMovement } from "@/lib/inventory";

export type OccupancyKind = "rental" | "maintenance";

/** Unidades ocupadas entre `start` e `end` (inclusive; `end` null = sem fim). */
export type Occupancy = {
  start: string;
  end: string | null;
  quantity: number;
  kind: OccupancyKind;
  /** Reserva ou manutenção de origem (para explicar a ocupação). */
  refId?: string;
};

export type DayAvailability = {
  date: string;
  total: number;
  reserved: number;
  maintenance: number;
  available: number;
};

export const MAX_PERIOD_DAYS = 400;

/** Dias de `from` a `to` (inclusive). */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to && days.length <= MAX_PERIOD_DAYS; d = addDaysISO(d, 1)) days.push(d);
  return days;
}

const covers = (o: Occupancy, date: string) => o.start <= date && (o.end === null || o.end >= date);

export function dailyAvailability(
  initial: number,
  movements: readonly StockMovement[],
  occupancies: readonly Occupancy[],
  from: string,
  to: string,
): DayAvailability[] {
  return eachDay(from, to).map((date) => {
    const total = totalAt(initial, movements, date);
    let reserved = 0;
    let maintenance = 0;
    for (const o of occupancies) {
      if (!covers(o, date)) continue;
      if (o.kind === "rental") reserved += o.quantity;
      else maintenance += o.quantity;
    }
    return { date, total, reserved, maintenance, available: total - reserved - maintenance };
  });
}

export type PeriodSummary = {
  /** Mínimo disponível no período e o primeiro dia em que ocorre. */
  minAvailable: number;
  minDate: string;
  maxReserved: number;
  maxMaintenance: number;
};

export function summarize(days: readonly DayAvailability[]): PeriodSummary {
  let min = days[0]!;
  let maxReserved = 0;
  let maxMaintenance = 0;
  for (const d of days) {
    if (d.available < min.available) min = d;
    maxReserved = Math.max(maxReserved, d.reserved);
    maxMaintenance = Math.max(maxMaintenance, d.maintenance);
  }
  return { minAvailable: min.available, minDate: min.date, maxReserved, maxMaintenance };
}

// ---------------------------------------------------------------------------
// Ocupação de uma linha de reserva
// ---------------------------------------------------------------------------

export type RentalStatusKey =
  | "RESERVADO"
  | "CONFLITO_STOCK"
  | "EM_PREPARACAO"
  | "ENTREGUE"
  | "EM_DEVOLUCAO"
  | "DEVOLVIDO"
  | "CANCELADO";

/** Estados em que o material está com o cliente (pode haver atraso). */
export const OUT_STATUSES: readonly RentalStatusKey[] = ["ENTREGUE", "EM_DEVOLUCAO"];

/** Dias para além de hoje que um aluguer em atraso continua a ocupar. */
export const OVERDUE_PROJECTION_DAYS = 1;

export type RentalLine = {
  rentalId: string;
  status: RentalStatusKey;
  quantity: number;
  prepBufferDays: number;
  /** Entrega prevista (início da ocupação). */
  deliveryDate: string;
  /** Recolha prevista (sem os dias de preparação). */
  returnDate: string;
  /** Devoluções já registadas desta linha. `damaged` está incluído em `returned`. */
  returns: readonly { date: string; returned: number; damaged: number }[];
};

/**
 * Ocupação de uma linha de reserva (plano §3.2):
 *  - reservada / entregue: da entrega até à recolha + dias de preparação;
 *  - devolvida em boas condições a D: ocupa até D + preparação;
 *  - devolvida danificada a D: ocupa até D−1 (a manutenção criada a D cobre o resto);
 *  - por devolver depois da data prevista (atraso): ocupa até hoje + projeção,
 *    até a devolução ser registada;
 *  - cancelada: não ocupa.
 */
export function rentalOccupancy(line: RentalLine, today: string): Occupancy[] {
  if (line.status === "CANCELADO") return [];
  const result: Occupancy[] = [];
  const base = { kind: "rental" as const, refId: line.rentalId, start: line.deliveryDate };
  let returned = 0;

  for (const r of line.returns) {
    returned += r.returned;
    const good = r.returned - r.damaged;
    if (good > 0) result.push({ ...base, end: addDaysISO(r.date, line.prepBufferDays), quantity: good });
    const damagedEnd = addDaysISO(r.date, -1);
    if (r.damaged > 0 && damagedEnd >= line.deliveryDate) result.push({ ...base, end: damagedEnd, quantity: r.damaged });
  }

  const remaining = line.quantity - returned;
  if (remaining > 0 && line.status !== "DEVOLVIDO") {
    let end = addDaysISO(line.returnDate, line.prepBufferDays);
    if (OUT_STATUSES.includes(line.status) && today > line.returnDate) {
      const projected = addDaysISO(today, OVERDUE_PROJECTION_DAYS + line.prepBufferDays);
      if (projected > end) end = projected;
    }
    result.push({ ...base, end, quantity: remaining });
  }
  return result;
}

/** Último dia em que uma linha nova ocupa stock (recolha + preparação). */
export function blockEnd(returnDate: string, prepBufferDays: number): string {
  return addDaysISO(returnDate, prepBufferDays);
}
