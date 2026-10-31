import type { PriceUnit, TaxLine } from "@/lib/pricing";

/**
 * Fotografia imutável de um orçamento no momento da emissão (QuoteVersion.snapshot).
 * O PDF é gerado só a partir daqui: mudanças posteriores no catálogo, no cliente
 * ou nas definições da empresa nunca alteram uma versão já emitida.
 */
export type QuoteSnapshot = {
  schemaVersion: 1;
  number: string;
  version: number;
  /** Data/hora de emissão (ISO). Num rascunho, a data da pré-visualização. */
  issuedAt: string;
  issuedBy: string | null;
  company: {
    legalName: string;
    tradeName: string;
    nif: string | null;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    country: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    iban: string | null;
    logoKey: string | null;
  };
  client: {
    name: string;
    nif: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    country: string;
  };
  contact: { name: string; email: string | null; phone: string | null } | null;
  event: { name: string; venue: string | null; city: string | null };
  dates: { delivery: string; start: string; end: string; return: string };
  billableDays: number;
  validUntil: string;
  items: {
    sku: string;
    name: string;
    unit: string;
    quantity: number;
    unitPriceCents: number;
    priceUnit: PriceUnit;
    billableDays: number;
    discountBp: number;
    taxRateBp: number;
    totalCents: number;
    imageKey: string | null;
  }[];
  services: { description: string; quantity: number; unitPriceCents: number; taxRateBp: number; totalCents: number }[];
  globalDiscountBp: number;
  totals: {
    subtotalCents: number;
    discountCents: number;
    servicesCents: number;
    taxLines: TaxLine[];
    taxCents: number;
    totalCents: number;
  };
  notes: string | null;
  terms: string | null;
};
