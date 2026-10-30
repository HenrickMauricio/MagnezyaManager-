/**
 * Formatação em português de Portugal (moeda, números, datas).
 * Os valores monetários circulam sempre em cêntimos (inteiros).
 */

export const LOCALE = "pt-PT";
export const TIME_ZONE = "Europe/Lisbon";

const currency = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "EUR" });
const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const dateLongFmt = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

/** 123456 → "1234,56 €" (formato pt-PT). */
export function formatCents(cents: number): string {
  return currency.format(cents / 100);
}

export function formatInteger(value: number): string {
  return integer.format(value);
}

/** 2300 → "23 %" */
export function formatBasisPoints(bp: number): string {
  return percent.format(bp / 10000);
}

export function formatDate(value: Date | string): string {
  return dateFmt.format(new Date(value));
}

export function formatDateLong(value: Date | string): string {
  return dateLongFmt.format(new Date(value));
}

export function formatDateTime(value: Date | string): string {
  return dateTimeFmt.format(new Date(value));
}

/**
 * Converte texto introduzido pelo utilizador ("1.234,56" ou "1234.56") em cêntimos.
 * Devolve null se o valor não for válido.
 */
export function parseEurosToCents(input: string): number | null {
  const cleaned = input.replace(/[€\s ]/g, "");
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}
