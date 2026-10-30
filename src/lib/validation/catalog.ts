import { z } from "zod";
import { parseEurosToCents } from "@/lib/format";
import { optionalText, requiredText } from "./common";

export const ARTICLE_STATUSES = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  DESCONTINUADO: "Descontinuado",
} as const;

export const PRICE_UNITS = { POR_DIA: "Por dia", POR_EVENTO: "Por evento" } as const;

export const MOVEMENT_TYPES = {
  ENTRADA: "Entrada",
  ABATE: "Abate",
  AJUSTE: "Ajuste",
} as const;

export const MAINTENANCE_STATUSES = {
  ABERTA: "Aberta",
  EM_CURSO: "Em reparação",
  CONCLUIDA: "Concluída",
  ABATIDA: "Abatida",
} as const;

/** Unidades sugeridas no formulário (o campo aceita outras). */
export const UNIT_SUGGESTIONS = ["un", "conjunto", "par", "kit", "m", "m²"];

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  // Recusa datas inexistentes (ex.: 30/02), que o Date "corrigiria" para março.
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Data inválida.");

const optionalIsoDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(isoDate.nullable());

const integer = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Indique ${label}.`)
    .regex(/^-?\d+$/, "Indique um número inteiro.")
    .transform(Number)
    .pipe(z.number().min(min, `Mínimo ${min}.`).max(max, `Máximo ${max}.`));

/** Valor em euros ("12,50") → cêntimos. */
const euros = (opts: { required: boolean }) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") {
        if (opts.required) ctx.addIssue({ code: "custom", message: "Indique o preço." });
        return null;
      }
      const cents = parseEurosToCents(v);
      if (cents === null || cents < 0) {
        ctx.addIssue({ code: "custom", message: "Valor inválido (ex.: 12,50)." });
        return z.NEVER;
      }
      if (cents > 100_000_000) {
        ctx.addIssue({ code: "custom", message: "Valor demasiado alto." });
        return z.NEVER;
      }
      return cents;
    });

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export const categorySchema = z.object({
  name: requiredText("o nome", 80),
  skuPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,6}$/, "Use 2 a 6 letras (ex.: CAD)."),
  description: optionalText(500),
  prepBufferDays: integer("os dias de preparação", 0, 30),
});

export type CategoryInput = z.output<typeof categorySchema>;

// ---------------------------------------------------------------------------
// Artigos
// ---------------------------------------------------------------------------

const articleFields = {
  name: requiredText("o nome", 150),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z0-9][A-Z0-9._-]{1,39}$/.test(v), "Use letras, números, hífen ou ponto (2 a 40).")
    .transform((v) => (v === "" ? null : v)),
  categoryId: z.string().trim().min(1, "Escolha a categoria."),
  description: optionalText(2000),
  unit: requiredText("a unidade", 20),
  priceCents: euros({ required: true }).pipe(z.number()),
  priceUnit: z.enum(["POR_DIA", "POR_EVENTO"], { error: "Escolha a unidade de preço." }),
  taxRateId: z.string().trim().min(1, "Escolha a taxa de IVA."),
  status: z.enum(["ATIVO", "INATIVO", "DESCONTINUADO"], { error: "Escolha o estado." }),
  internalNotes: optionalText(2000),
};

export const createArticleSchema = z.object({
  ...articleFields,
  stockBase: integer("o stock inicial", 0, 1_000_000),
});

/** Na edição o stock inicial não muda: as alterações fazem-se por movimentos. */
export const updateArticleSchema = z.object(articleFields);

export type CreateArticleInput = z.output<typeof createArticleSchema>;
export type UpdateArticleInput = z.output<typeof updateArticleSchema>;

export const articleListSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  categoria: z.string().trim().max(40).catch(""),
  estado: z.enum(["ativos", "inativos", "descontinuados", "arquivados", "todos"]).catch("ativos"),
  ordem: z.enum(["nome", "sku", "preco", "recentes"]).catch("nome"),
  pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type ArticleListParams = z.output<typeof articleListSchema>;

// ---------------------------------------------------------------------------
// Movimentos de stock
// ---------------------------------------------------------------------------

export const movementSchema = z
  .object({
    type: z.enum(["ENTRADA", "ABATE", "AJUSTE"], { error: "Escolha o tipo de movimento." }),
    quantity: integer("a quantidade", -1_000_000, 1_000_000),
    effectiveDate: isoDate,
    reason: requiredText("o motivo", 300),
  })
  .superRefine((d, ctx) => {
    if (d.quantity === 0) ctx.addIssue({ code: "custom", path: ["quantity"], message: "A quantidade não pode ser zero." });
    if (d.type !== "AJUSTE" && d.quantity < 0) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Indique uma quantidade positiva." });
    }
  });

export type MovementInput = z.output<typeof movementSchema>;

export const movementListSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  tipo: z.enum(["todos", "ENTRADA", "ABATE", "AJUSTE"]).catch("todos"),
  pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type MovementListParams = z.output<typeof movementListSchema>;

// ---------------------------------------------------------------------------
// Manutenção
// ---------------------------------------------------------------------------

export const maintenanceSchema = z
  .object({
    quantity: integer("a quantidade", 1, 1_000_000),
    startDate: isoDate,
    expectedEndDate: optionalIsoDate,
    reason: requiredText("o motivo", 300),
    costCents: euros({ required: false }),
  })
  .superRefine((d, ctx) => {
    if (d.expectedEndDate && d.expectedEndDate < d.startDate) {
      ctx.addIssue({ code: "custom", path: ["expectedEndDate"], message: "Não pode ser anterior ao início." });
    }
  });

export type MaintenanceInput = z.output<typeof maintenanceSchema>;

/** Fecho de uma manutenção: unidades reparadas voltam; as perdidas são abatidas. */
export const completeMaintenanceSchema = z.object({
  endDate: isoDate,
  lostQuantity: integer("as unidades perdidas", 0, 1_000_000),
  costCents: euros({ required: false }),
});

export type CompleteMaintenanceInput = z.output<typeof completeMaintenanceSchema>;
