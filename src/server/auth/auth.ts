import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/server/db";

/**
 * Configuração do Better Auth.
 *
 * - Sessões guardadas na base de dados → podem ser revogadas de imediato.
 * - Registo público DESATIVADO: só administradores criam contas.
 * - Utilizadores inativos ou arquivados não conseguem iniciar sessão
 *   (bloqueado no hook de criação de sessão, além da verificação no login).
 */
export const auth = betterAuth({
  appName: "Magnezya",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // renova uma vez por dia
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { active: true, archivedAt: true },
          });
          if (!user || !user.active || user.archivedAt) return false;
          return { data: session };
        },
      },
    },
  },
  plugins: [nextCookies()],
});
