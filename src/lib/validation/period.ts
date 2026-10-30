import { addDaysISO } from "@/lib/format";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const valid = (v: unknown): v is string =>
  typeof v === "string" && ISO.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/**
 * Período "de"–"até" vindo do URL. Valores em falta ou inválidos usam o
 * período por omissão; períodos invertidos ou demasiado longos são corrigidos.
 */
export function parsePeriod(
  params: { de?: unknown; ate?: unknown },
  today: string,
  { defaultDays, maxDays }: { defaultDays: number; maxDays: number },
): { from: string; to: string } {
  const from = valid(params.de) ? params.de : today;
  let to = valid(params.ate) ? params.ate : addDaysISO(from, defaultDays - 1);
  if (to < from) to = from;
  const limit = addDaysISO(from, maxDays - 1);
  if (to > limit) to = limit;
  return { from, to };
}
