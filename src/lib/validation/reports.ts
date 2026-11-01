import { z } from "zod";
import { REVENUE_BASES, type RevenueBasis } from "@/lib/reports";

/** Filtros dos relatórios (?ano=2026&base=evento); valores inválidos voltam ao padrão. */
export function reportParamsSchema(currentYear: number) {
  return z.object({
    ano: z.coerce.number().int().min(2000).max(2100).catch(currentYear),
    base: z.enum(Object.keys(REVENUE_BASES) as [RevenueBasis, ...RevenueBasis[]]).catch("evento"),
  });
}
