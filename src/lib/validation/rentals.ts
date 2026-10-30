import { z } from "zod";
import { optionalText, requiredText } from "./common";

export const RENTAL_STATUSES = {
  RESERVADO: "Reservado",
  CONFLITO_STOCK: "Conflito de stock",
  EM_PREPARACAO: "Em preparação",
  ENTREGUE: "Entregue",
  EM_DEVOLUCAO: "Devolução parcial",
  DEVOLVIDO: "Devolvido",
  CANCELADO: "Cancelado",
} as const;

export type RentalStatus = keyof typeof RENTAL_STATUSES;

/** Estados em que a reserva ainda pode ser cancelada (material não saiu). */
export const CANCELLABLE: readonly RentalStatus[] = ["RESERVADO", "CONFLITO_STOCK", "EM_PREPARACAO"];

const isoDate = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Indique ${label}.`)
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .refine((v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, "Data inválida.");

const positiveInt = z.coerce.number().int("Quantidade inteira.").min(1, "Mínimo 1.").max(100_000);

export const rentalLineSchema = z.object({
  articleId: z.string().trim().min(1, "Escolha o artigo."),
  quantity: positiveInt,
});

/**
 * Reserva direta (sem orçamento). Datas: entrega ≤ início ≤ fim ≤ recolha.
 * As linhas chegam como JSON (lista dinâmica no formulário).
 */
export const rentalSchema = z
  .object({
    clientId: z.string().trim().min(1, "Escolha o cliente."),
    eventName: requiredText("o nome do evento", 150),
    venue: optionalText(150),
    city: optionalText(100),
    deliveryDate: isoDate("a data de entrega"),
    startDate: isoDate("a data de início"),
    endDate: isoDate("a data de fim"),
    returnDate: isoDate("a data de recolha"),
    notes: optionalText(2000),
    lines: z
      .string()
      .transform((v, ctx) => {
        try {
          return JSON.parse(v) as unknown;
        } catch {
          ctx.addIssue({ code: "custom", message: "Linhas inválidas." });
          return z.NEVER;
        }
      })
      .pipe(z.array(rentalLineSchema).min(1, "Adicione pelo menos um artigo.").max(200)),
  })
  .superRefine((d, ctx) => {
    if (d.startDate < d.deliveryDate) {
      ctx.addIssue({ code: "custom", path: ["startDate"], message: "O início não pode ser antes da entrega." });
    }
    if (d.endDate < d.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "O fim não pode ser antes do início." });
    }
    if (d.returnDate < d.endDate) {
      ctx.addIssue({ code: "custom", path: ["returnDate"], message: "A recolha não pode ser antes do fim." });
    }
  })
  // Linhas repetidas do mesmo artigo são somadas.
  .transform((d) => {
    const merged = new Map<string, number>();
    for (const l of d.lines) merged.set(l.articleId, (merged.get(l.articleId) ?? 0) + l.quantity);
    return { ...d, lines: [...merged].map(([articleId, quantity]) => ({ articleId, quantity })) };
  });

export type RentalInput = z.output<typeof rentalSchema>;

export const deliverySchema = z.object({ date: isoDate("a data de entrega") });

/** Devolução: por linha, unidades devolvidas e, dessas, danificadas. */
export const returnSchema = z.object({
  date: isoDate("a data de devolução"),
  notes: optionalText(1000),
  lines: z
    .string()
    .transform((v, ctx) => {
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Linhas inválidas." });
        return z.NEVER;
      }
    })
    .pipe(
      z
        .array(
          z
            .object({
              rentalItemId: z.string().min(1),
              returned: z.coerce.number().int().min(0),
              damaged: z.coerce.number().int().min(0),
            })
            .refine((l) => l.damaged <= l.returned, "As danificadas não podem exceder as devolvidas."),
        )
        .refine((ls) => ls.some((l) => l.returned > 0), "Indique pelo menos uma unidade devolvida."),
    ),
});

export type ReturnInput = z.output<typeof returnSchema>;

export const rentalListSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  estado: z.enum(["ativas", "todas", ...(Object.keys(RENTAL_STATUSES) as RentalStatus[])]).catch("ativas"),
  pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type RentalListParams = z.output<typeof rentalListSchema>;
