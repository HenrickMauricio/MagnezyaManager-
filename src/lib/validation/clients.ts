import { z } from "zod";
import { isPlausibleForeignTaxId, isValidPortugueseNif, normalizeTaxId } from "@/lib/nif";
import { checkbox, optionalEmail, optionalPhone, optionalText, requiredText } from "./common";

/** Países mais comuns nos clientes da Magnezya (ISO 3166-1 alfa-2). */
export const COUNTRIES = {
  PT: "Portugal",
  ES: "Espanha",
  FR: "França",
  DE: "Alemanha",
  IT: "Itália",
  NL: "Países Baixos",
  BE: "Bélgica",
  LU: "Luxemburgo",
  IE: "Irlanda",
  CH: "Suíça",
  GB: "Reino Unido",
  US: "Estados Unidos",
  BR: "Brasil",
  AO: "Angola",
  MZ: "Moçambique",
  CV: "Cabo Verde",
} as const;

export type CountryCode = keyof typeof COUNTRIES;

export const CLIENT_TYPES = { EMPRESA: "Empresa", PARTICULAR: "Particular" } as const;

/**
 * Cliente (empresa ou particular). NIF obrigatório para ambos:
 * validado com dígito de controlo quando o país é Portugal.
 */
export const clientSchema = z
  .object({
    type: z.enum(["EMPRESA", "PARTICULAR"], { error: "Escolha o tipo de cliente." }),
    name: requiredText("o nome", 200),
    nif: z.string().trim().min(1, "Indique o NIF.").transform(normalizeTaxId),
    email: optionalEmail,
    phone: optionalPhone,
    billingAddress: optionalText(300),
    postalCode: optionalText(20),
    city: optionalText(100),
    country: z.enum(Object.keys(COUNTRIES) as [CountryCode, ...CountryCode[]], { error: "País inválido." }),
    notes: optionalText(2000),
    gdprConsent: checkbox,
  })
  .superRefine((data, ctx) => {
    if (data.country === "PT") {
      if (!isValidPortugueseNif(data.nif)) {
        ctx.addIssue({ code: "custom", path: ["nif"], message: "NIF português inválido." });
      }
      if (data.postalCode && !/^\d{4}-\d{3}$/.test(data.postalCode)) {
        ctx.addIssue({ code: "custom", path: ["postalCode"], message: "Código postal no formato 0000-000." });
      }
    } else if (!isPlausibleForeignTaxId(data.nif)) {
      ctx.addIssue({ code: "custom", path: ["nif"], message: "Identificador fiscal inválido." });
    }
  })
  // NIF português guardado sem o prefixo "PT".
  .transform((data) => ({ ...data, nif: data.country === "PT" ? data.nif.replace(/^PT/, "") : data.nif }));

export type ClientInput = z.output<typeof clientSchema>;

export const contactSchema = z.object({
  name: requiredText("o nome", 150),
  jobTitle: optionalText(100),
  email: optionalEmail,
  phone: optionalPhone,
  isPrimary: checkbox,
});

export type ContactInput = z.output<typeof contactSchema>;

/** Filtros da lista de clientes (vindos do URL). */
export const clientListSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  estado: z.enum(["ativos", "arquivados"]).catch("ativos"),
  ordem: z.enum(["nome", "cidade", "recentes"]).catch("nome"),
  pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type ClientListParams = z.output<typeof clientListSchema>;
