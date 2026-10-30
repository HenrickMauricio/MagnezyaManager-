import "server-only";
import { prisma } from "@/server/db";
import { assertPermission, type CurrentUser } from "@/server/auth/session";
import { ForbiddenError } from "@/server/errors";

/**
 * Dados do portal do cliente. TODAS as queries são filtradas pelo clientId da
 * sessão — nunca por um id vindo do browser.
 */
export async function getPortalOverview(user: CurrentUser) {
  assertPermission(user, "portal:access");
  if (!user.clientId) throw new ForbiddenError();

  const visibleStatuses = ["ENVIADO", "APROVADO", "REJEITADO", "EXPIRADO"] as const;

  const [client, pending, total] = await Promise.all([
    prisma.client.findUniqueOrThrow({
      where: { id: user.clientId },
      select: { name: true, email: true, phone: true, city: true },
    }),
    prisma.quote.count({ where: { clientId: user.clientId, status: "ENVIADO" } }),
    prisma.quote.count({ where: { clientId: user.clientId, status: { in: [...visibleStatuses] } } }),
  ]);

  return { client, pending, total };
}
