import { z } from "zod";
import { ROLE_KEYS } from "@/lib/permissions";
import { optionalPhone, requiredText } from "./common";

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `A palavra-passe tem de ter pelo menos ${PASSWORD_MIN} caracteres.`)
  .max(PASSWORD_MAX, `Máximo de ${PASSWORD_MAX} caracteres.`);

const email = z.string().trim().toLowerCase().min(1, "Indique o email.").pipe(z.email("Email inválido."));

/** Percentagem introduzida no formulário ("10" ou "7,5") → pontos-base. */
const discountPercent = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return 0;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      ctx.addIssue({ code: "custom", message: "Indique uma percentagem entre 0 e 100." });
      return z.NEVER;
    }
    return Math.round(n * 100);
  });

const userFields = {
  name: requiredText("o nome", 150),
  email,
  phone: optionalPhone,
  role: z.enum(ROLE_KEYS, { error: "Escolha o perfil." }),
  clientId: z.string().trim().transform((v) => (v === "" ? null : v)),
  maxDiscountBp: discountPercent,
};

function requireClientForPortal<T extends { role: string; clientId: string | null }>(
  data: T,
  ctx: z.RefinementCtx,
) {
  if (data.role === "CLIENTE" && !data.clientId) {
    ctx.addIssue({ code: "custom", path: ["clientId"], message: "Escolha o cliente desta conta do portal." });
  }
}

export const createUserSchema = z
  .object({ ...userFields, password: passwordSchema })
  .superRefine(requireClientForPortal);

export const updateUserSchema = z.object(userFields).superRefine(requireClientForPortal);

export type CreateUserInput = z.output<typeof createUserSchema>;
export type UpdateUserInput = z.output<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({ password: passwordSchema });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Indique a palavra-passe atual."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .superRefine((d, ctx) => {
    if (d.newPassword !== d.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "As palavras-passe não coincidem." });
    }
    if (d.newPassword === d.currentPassword) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: "Escolha uma palavra-passe diferente da atual." });
    }
  });

/** Filtros da lista de utilizadores (vindos do URL). */
export const userListSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  perfil: z.enum(["todos", ...ROLE_KEYS]).catch("todos"),
  estado: z.enum(["todos", "ativos", "inativos"]).catch("ativos"),
  pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type UserListParams = z.output<typeof userListSchema>;
