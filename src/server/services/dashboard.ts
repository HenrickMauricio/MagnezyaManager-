import "server-only";
import { prisma } from "@/server/db";
import { assertPermission, type CurrentUser } from "@/server/auth/session";

/**
 * Indicadores do painel (Fase 1: catálogo, clientes e atividade).
 * Os indicadores de alugueres, disponibilidade e orçamentos entram nas fases 4–5.
 */
export async function getDashboardOverview(user: CurrentUser) {
  assertPermission(user, "dashboard:view");

  const activeArticle = { archivedAt: null, status: "ATIVO" as const };

  const [articles, stockBase, movements, categories, clients, quotes, recentActivity] = await Promise.all([
    prisma.article.count({ where: activeArticle }),
    prisma.article.aggregate({ where: activeArticle, _sum: { stockBase: true } }),
    prisma.inventoryMovement.aggregate({
      where: { article: activeArticle, effectiveDate: { lte: new Date() } },
      _sum: { quantity: true },
    }),
    prisma.category.count({ where: { archivedAt: null } }),
    prisma.client.count({ where: { archivedAt: null } }),
    prisma.quote.count(),
    user.permissions.has("audit:view")
      ? prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { actor: { select: { name: true } } },
        })
      : Promise.resolve(null),
  ]);

  return {
    articles,
    units: (stockBase._sum.stockBase ?? 0) + (movements._sum.quantity ?? 0),
    categories,
    clients,
    quotes,
    recentActivity,
  };
}

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Iniciou sessão",
  "auth.logout": "Terminou sessão",
  "auth.login_failed": "Tentativa de login falhada",
  "auth.login_throttled": "Login bloqueado (demasiadas tentativas)",
};

export function describeAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
