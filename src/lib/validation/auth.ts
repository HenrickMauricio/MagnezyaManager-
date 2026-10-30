import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Indique o email.")
    .email("Email inválido."),
  password: z.string().min(1, "Indique a palavra-passe.").max(128),
  next: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
