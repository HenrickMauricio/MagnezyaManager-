import { z } from "zod";

/** Texto opcional de formulário: vazio → null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

export const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `Indique ${label}.`).max(max, `Máximo de ${max} caracteres.`);

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine((v) => v === "" || z.email().safeParse(v).success, "Email inválido.")
  .transform((v) => (v === "" ? null : v));

/** Telefone: dígitos, espaços, +, (, ), - — entre 6 e 20 caracteres. */
export const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || /^[+0-9 ()-]{6,20}$/.test(v), "Telefone inválido.")
  .transform((v) => (v === "" ? null : v));

/** Checkbox HTML: presente ("on") → true; desmarcada não é enviada → false. */
export const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

/** Converte FormData num objeto simples (campos repetidos → último valor). */
export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}

/** Erros por campo no formato usado pelos formulários. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}
