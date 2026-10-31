import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/server/db";

/**
 * Limite de tentativas de login falhadas, contado a partir de `audit_logs`.
 *
 * O rate limiting do Better Auth só se aplica a pedidos HTTP ao seu handler
 * (/api/auth/*); o login da aplicação chama `auth.api.signInEmail` dentro de
 * uma Server Action, por isso o limite tem de ser aplicado aqui.
 * Guardado na BD → funciona com várias instâncias da aplicação.
 */
const WINDOW_MS = 60_000;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;

/** IP de origem do pedido atual (null fora de um pedido HTTP, ex.: scripts e testes). */
export async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
  } catch {
    return null;
  }
}

export async function isLoginThrottled(email: string, ip: string | null): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const base = { action: "auth.login_failed", createdAt: { gte: since } };

  const byEmail = await prisma.auditLog.count({
    where: { ...base, after: { path: ["email"], equals: email } },
  });
  if (byEmail >= MAX_PER_EMAIL) return true;

  if (!ip) return false;
  const byIp = await prisma.auditLog.count({ where: { ...base, ip } });
  return byIp >= MAX_PER_IP;
}
