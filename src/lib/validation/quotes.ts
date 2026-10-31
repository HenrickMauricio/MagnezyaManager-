import { z } from "zod";
import { parseEurosToCents } from "@/lib/format";
import { optionalText, requiredText } from "./common";

export const QUOTE_STATUSES = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_APROVACAO: "A aguardar aprovação",
  ENVIADO: "Emitido",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  EXPIRADO: "Expirado",
  CANCELADO: "Cancelado",
} as const;

export type QuoteStatus = keyof typeof QUOTE_STATUSES;

/** Estados em que o orçamento ainda pode ser editado (volta a rascunho). */
export const EDITABLE_STATUSES: readonly QuoteStatus[] = ["RASCUNHO", "AGUARDANDO_APROVACAO", "ENVIADO", "EXPIRADO"];
export const OPEN_STATUSES: readonly QuoteStatus[] = ["RASCUNHO", "AGUARDANDO_APROVACAO", "ENVIADO"];

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

/** Percentagem ("10", "7,5") → pontos-base. Vazio = 0. */
export const percentBp = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const s = String(v).trim();
    if (s === "") return 0;
    const n = Number(s.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      ctx.addIssue({ code: "custom", message: "Percentagem entre 0 e 100." });
      return z.NEVER;
    }
    return Math.round(n * 100);
  });

const json = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .string()
    .transform((v, ctx) => {
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Dados inválidos." });
        return z.NEVER;
      }
    })
    .pipe(schema);

const itemSchema = z.object({
  articleId: z.string().min(1),
  quantity: z.coerce.number().int().min(1, "Quantidade mínima 1.").max(100_000),
  discountBp: percentBp,
});

const serviceLineSchema = z.object({
  serviceId: z.string().min(1).nullable(),
  description: requiredText("a descrição do serviço", 200),
  quantity: z.coerce.number().int().min(1).max(10_000),
  price: z.union([z.string(), z.number()]).transform((v, ctx) => {
    const cents = parseEurosToCents(String(v));
    if (cents === null || cents < 0) {
      ctx.addIssue({ code: "custom", message: "Preço de serviço inválido." });
      return z.NEVER;
    }
    return cents;
  }),
});

/**
 * Orçamento vindo do construtor. Datas: entrega ≤ início ≤ fim ≤ recolha.
 * Preços dos artigos NÃO vêm do browser: são lidos do catálogo no servidor.
 */
export const quoteSchema = z
  .object({
    clientId: z.string().trim().min(1, "Escolha o cliente."),
    eventName: requiredText("o nome do evento", 150),
    venue: optionalText(150),
    city: optionalText(100),
    deliveryDate: isoDate("a data de entrega"),
    startDate: isoDate("a data de início"),
    endDate: isoDate("a data de fim"),
    returnDate: isoDate("a data de recolha"),
    validUntil: isoDate("a validade"),
    discount: percentBp,
    notes: optionalText(3000),
    internalNotes: optionalText(3000),
    terms: optionalText(5000),
    /** Versão do registo quando o formulário foi aberto (bloqueio otimista). */
    lockVersion: z.coerce.number().int().min(0).optional(),
    items: json(z.array(itemSchema).min(1, "Adicione pelo menos um artigo.").max(300)),
    services: json(z.array(serviceLineSchema).max(50)),
  })
  .superRefine((d, ctx) => {
    if (d.startDate < d.deliveryDate) ctx.addIssue({ code: "custom", path: ["startDate"], message: "O início não pode ser antes da entrega." });
    if (d.endDate < d.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "O fim não pode ser antes do início." });
    if (d.returnDate < d.endDate) ctx.addIssue({ code: "custom", path: ["returnDate"], message: "A recolha não pode ser antes do fim." });
    const ids = d.items.map((i) => i.articleId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["items"], message: "O mesmo artigo aparece em mais de uma linha." });
    }
  });

export type QuoteInput = z.output<typeof quoteSchema>;

export const rejectSchema = z.object({ reason: optionalText(500) });

export const quoteListSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  estado: z.enum(["abertos", "todos", ...(Object.keys(QUOTE_STATUSES) as QuoteStatus[])]).catch("abertos"),
  autor: z.enum(["todos", "meus"]).catch("todos"),
  pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type QuoteListParams = z.output<typeof quoteListSchema>;
