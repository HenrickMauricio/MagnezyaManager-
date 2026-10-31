import { z } from "zod";
import { parseEurosToCents } from "@/lib/format";
import { isValidPortugueseNif, normalizeTaxId } from "@/lib/nif";
import { checkbox, optionalEmail, optionalPhone, optionalText, requiredText } from "./common";

/** IBAN português: PT50 + 21 dígitos (espaços opcionais). */
const optionalIban = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, "").toUpperCase())
  .refine((v) => v === "" || /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v), "IBAN inválido.")
  .transform((v) => (v === "" ? null : v));

export const companySettingsSchema = z.object({
  legalName: requiredText("a denominação legal", 200),
  tradeName: requiredText("o nome comercial", 100),
  nif: z
    .string()
    .trim()
    .transform(normalizeTaxId)
    .refine((v) => v === "" || isValidPortugueseNif(v), "NIF português inválido.")
    .transform((v) => (v === "" ? null : v.replace(/^PT/, ""))),
  address: optionalText(300),
  postalCode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{3}$/.test(v), "Código postal no formato 0000-000.")
    .transform((v) => (v === "" ? null : v)),
  city: optionalText(100),
  phone: optionalPhone,
  email: optionalEmail,
  website: optionalText(200),
  iban: optionalIban,
  quotePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,6}$/, "Use 2 a 6 letras (ex.: ORC)."),
  quoteValidityDays: z.coerce.number().int().min(1, "Mínimo 1 dia.").max(365, "Máximo 365 dias."),
  defaultTerms: optionalText(5000),
});

export type CompanySettingsInput = z.output<typeof companySettingsSchema>;

export const serviceSchema = z.object({
  name: requiredText("o nome", 120),
  description: optionalText(500),
  unit: requiredText("a unidade", 30),
  defaultPriceCents: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const cents = parseEurosToCents(v);
      if (cents === null || cents < 0) {
        ctx.addIssue({ code: "custom", message: "Valor inválido (ex.: 95,00)." });
        return z.NEVER;
      }
      return cents;
    }),
  taxRateId: z.string().trim().min(1, "Escolha a taxa de IVA."),
  active: checkbox,
});

export type ServiceInput = z.output<typeof serviceSchema>;
