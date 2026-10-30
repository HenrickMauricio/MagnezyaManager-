import "server-only";
import { prisma } from "@/server/db";
import { assertPermission, type CurrentUser } from "@/server/auth/session";
import { getMaintenanceSummary } from "@/server/services/inventory";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Indicadores do painel, adaptados ao perfil:
 * - administrador: visão global, utilizadores e auditoria;
 * - vendedor: os seus orçamentos e clientes.
 * Os indicadores de alugueres e disponibilidade entram na Fase 4.
 */
export async function getDashboardOverview(user: CurrentUser) {
  assertPermission(user, "dashboard:view");

  const activeArticle = { archivedAt: null, status: "ATIVO" as const };
  const since30Days = new Date(Date.now() - 30 * DAY_MS);
  const isManager = user.permissions.has("user:manage");
  const canSeeClients = user.permissions.has("client:view");

  const [
    articles,
    stockBase,
    movements,
    clients,
    newClients,
    quotes,
    myQuotes,
    users,
    recentClients,
    recentActivity,
    maintenance,
  ] = await Promise.all([
    prisma.article.count({ where: activeArticle }),
    prisma.article.aggregate({ where: activeArticle, _sum: { stockBase: true } }),
    prisma.inventoryMovement.aggregate({
      where: { article: activeArticle, effectiveDate: { lte: new Date() } },
      _sum: { quantity: true },
    }),
    prisma.client.count({ where: { archivedAt: null } }),
    prisma.client.count({ where: { archivedAt: null, createdAt: { gte: since30Days } } }),
    prisma.quote.count(),
    prisma.quote.count({ where: { createdById: user.id } }),
    isManager
      ? Promise.all([
          prisma.user.count({ where: { active: true, archivedAt: null, role: { key: { not: "CLIENTE" } } } }),
          prisma.user.count({ where: { active: true, archivedAt: null, role: { key: "CLIENTE" } } }),
          prisma.user.count({ where: { active: true, archivedAt: null, mustChangePassword: true } }),
        ]).then(([internal, portal, pendingPassword]) => ({ internal, portal, pendingPassword }))
      : Promise.resolve(null),
    canSeeClients
      ? prisma.client.findMany({
          where: { archivedAt: null },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, name: true, city: true, createdAt: true, createdBy: { select: { name: true } } },
        })
      : Promise.resolve(null),
    user.permissions.has("audit:view")
      ? prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { actor: { select: { name: true } } },
        })
      : Promise.resolve(null),
    getMaintenanceSummary(),
  ]);

  return {
    articles,
    units: (stockBase._sum.stockBase ?? 0) + (movements._sum.quantity ?? 0),
    clients,
    newClients,
    quotes,
    myQuotes,
    users,
    recentClients,
    recentActivity,
    maintenance,
  };
}

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Iniciou sessão",
  "auth.logout": "Terminou sessão",
  "auth.login_failed": "Tentativa de login falhada",
  "auth.login_throttled": "Login bloqueado (demasiadas tentativas)",
  "auth.password_changed": "Alterou a palavra-passe",
  "client.create": "Criou um cliente",
  "client.update": "Editou um cliente",
  "client.archive": "Arquivou um cliente",
  "client.restore": "Restaurou um cliente",
  "contact.create": "Adicionou um contacto",
  "contact.update": "Editou um contacto",
  "contact.delete": "Eliminou um contacto",
  "user.create": "Criou um utilizador",
  "user.update": "Editou um utilizador",
  "user.activate": "Ativou uma conta",
  "user.deactivate": "Desativou uma conta",
  "user.password_reset": "Repôs uma palavra-passe",
  "user.permissions": "Alterou permissões",
  "category.create": "Criou uma categoria",
  "category.update": "Editou uma categoria",
  "category.archive": "Arquivou uma categoria",
  "category.restore": "Restaurou uma categoria",
  "article.create": "Criou um artigo",
  "article.update": "Editou um artigo",
  "article.archive": "Arquivou um artigo",
  "article.restore": "Restaurou um artigo",
  "article.image_add": "Adicionou uma fotografia",
  "article.image_primary": "Mudou a fotografia principal",
  "article.image_delete": "Eliminou uma fotografia",
  "movement.create": "Registou um movimento de stock",
  "maintenance.create": "Registou uma manutenção",
  "maintenance.start": "Iniciou uma reparação",
  "maintenance.complete": "Concluiu uma manutenção",
  "maintenance.cancel": "Anulou uma manutenção",
};

export function describeAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** Link para o registo afetado (quando existe uma página para ele). */
export function auditTargetHref(entity: string, entityId: string | null): string | null {
  if (!entityId) return null;
  if (entity === "Client") return `/clientes/${entityId}`;
  if (entity === "User") return `/utilizadores/${entityId}`;
  if (entity === "Article") return `/artigos/${entityId}`;
  if (entity === "Category") return "/categorias";
  return null;
}
