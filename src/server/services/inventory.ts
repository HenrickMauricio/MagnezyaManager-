import "server-only";
import { prisma } from "@/server/db";
import { assertPermission, type CurrentUser } from "@/server/auth/session";
import { ConflictError, NotFoundError } from "@/server/errors";
import { logAudit } from "@/server/services/audit";
import { loadArticleStock } from "@/server/services/availability";
import type { Prisma } from "@/generated/prisma/client";
import {
  findShortage,
  maintenanceAt,
  signedQuantity,
  totalAt,
  type StockShortage,
} from "@/lib/inventory";
import { addDaysISO, dateOnlyToISO, formatISODate, isoToDateOnly, todayISO } from "@/lib/format";
import type {
  CompleteMaintenanceInput,
  MaintenanceInput,
  MovementInput,
  MovementListParams,
} from "@/lib/validation/catalog";

type Tx = Prisma.TransactionClient;

const OPEN_STATUSES = ["ABERTA", "EM_CURSO"] as const;
export const MOVEMENT_PAGE_SIZE = 25;

/**
 * Stock total e unidades em manutenção hoje, por artigo (para listas).
 * A disponibilidade com reservas vem do motor (services/availability).
 */
export async function getStockFigures(articleIds: string[], date = todayISO()) {
  const result = new Map<string, { total: number; inMaintenance: number }>();
  if (articleIds.length === 0) return result;

  const day = isoToDateOnly(date);
  const [articles, movements, maintenances] = await Promise.all([
    prisma.article.findMany({ where: { id: { in: articleIds } }, select: { id: true, stockBase: true } }),
    prisma.inventoryMovement.groupBy({
      by: ["articleId"],
      where: { articleId: { in: articleIds }, effectiveDate: { lte: day } },
      _sum: { quantity: true },
    }),
    prisma.maintenance.findMany({
      where: {
        articleId: { in: articleIds },
        startDate: { lte: day },
        OR: [{ endDate: null }, { endDate: { gt: day } }],
      },
      select: { articleId: true, quantity: true },
    }),
  ]);

  for (const a of articles) result.set(a.id, { total: a.stockBase, inMaintenance: 0 });
  for (const m of movements) result.get(m.articleId)!.total += m._sum.quantity ?? 0;
  for (const m of maintenances) result.get(m.articleId)!.inMaintenance += m.quantity;
  return result;
}

/**
 * Bloqueia o artigo (SELECT … FOR UPDATE) e devolve o seu histórico de stock
 * com todas as ocupações — reservas e manutenções — vindas do motor.
 */
async function lockArticleStock(tx: Tx, articleId: string) {
  await tx.$queryRaw`SELECT id FROM articles WHERE id = ${articleId} FOR UPDATE`;
  const article = await tx.article.findUnique({
    where: { id: articleId },
    select: { id: true, name: true, unit: true, stockBase: true, archivedAt: true },
  });
  if (!article) throw new NotFoundError("Artigo não encontrado.");
  const stock = (await loadArticleStock(tx, [articleId])).get(articleId)!;
  return { article, movements: stock.movements, periods: stock.occupancies };
}

function shortageMessage(s: StockShortage, unit: string): string {
  const date = formatISODate(s.date);
  if (s.total < 0) return `O stock ficaria negativo a ${date} (${s.total} ${unit}).`;
  return `A ${date} o stock seria ${s.total} ${unit}, mas há ${s.inMaintenance} ocupadas (reservas e manutenção).`;
}

// ---------------------------------------------------------------------------
// Movimentos
// ---------------------------------------------------------------------------

export async function listArticleMovements(user: CurrentUser, articleId: string) {
  assertPermission(user, "article:view");
  return prisma.inventoryMovement.findMany({
    where: { articleId },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    take: 50,
    include: { user: { select: { name: true } } },
  });
}

export async function listMovements(user: CurrentUser, params: MovementListParams) {
  assertPermission(user, "inventory:manage");
  const where: Prisma.InventoryMovementWhereInput = {};
  if (params.tipo !== "todos") where.type = params.tipo;
  if (params.q) {
    const contains = { contains: params.q, mode: "insensitive" as const };
    where.OR = [{ article: { name: contains } }, { article: { sku: contains } }, { reason: contains }];
  }
  const [items, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (params.pagina - 1) * MOVEMENT_PAGE_SIZE,
      take: MOVEMENT_PAGE_SIZE,
      include: {
        user: { select: { name: true } },
        article: { select: { id: true, name: true, sku: true, unit: true } },
      },
    }),
    prisma.inventoryMovement.count({ where }),
  ]);
  return { items, total, page: params.pagina, pageSize: MOVEMENT_PAGE_SIZE };
}

/**
 * Regista uma entrada, abate ou ajuste. Recusa movimentos que deixariam o
 * stock negativo, ou abaixo das unidades em manutenção, em qualquer dia.
 */
export async function createMovement(user: CurrentUser, articleId: string, input: MovementInput) {
  assertPermission(user, "inventory:manage");
  const quantity = signedQuantity(input.type, input.quantity);

  await prisma.$transaction(async (tx) => {
    const { article, movements, periods } = await lockArticleStock(tx, articleId);
    if (article.archivedAt) throw new ConflictError("O artigo está arquivado.");

    const shortage = findShortage(article.stockBase, [...movements, { date: input.effectiveDate, quantity }], periods);
    if (shortage) throw new ConflictError(shortageMessage(shortage, article.unit));

    const movement = await tx.inventoryMovement.create({
      data: {
        articleId,
        type: input.type,
        quantity,
        effectiveDate: isoToDateOnly(input.effectiveDate),
        reason: input.reason,
        userId: user.id,
      },
    });
    await logAudit(
      {
        actorId: user.id,
        action: "movement.create",
        entity: "Article",
        entityId: articleId,
        after: { movementId: movement.id, type: input.type, quantity, effectiveDate: input.effectiveDate, reason: input.reason },
      },
      tx,
    );
  });
}

// ---------------------------------------------------------------------------
// Manutenção
// ---------------------------------------------------------------------------

export async function listArticleMaintenances(user: CurrentUser, articleId: string) {
  assertPermission(user, "article:view");
  return prisma.maintenance.findMany({
    where: { articleId },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    take: 50,
    include: { user: { select: { name: true } } },
  });
}

/** Manutenções em aberto de todos os artigos (página de inventário). */
export async function listOpenMaintenances(user: CurrentUser) {
  assertPermission(user, "inventory:manage");
  return prisma.maintenance.findMany({
    where: { status: { in: [...OPEN_STATUSES] } },
    orderBy: [{ expectedEndDate: { sort: "asc", nulls: "last" } }, { startDate: "asc" }],
    include: { article: { select: { id: true, name: true, sku: true, unit: true } } },
  });
}

export async function createMaintenance(user: CurrentUser, articleId: string, input: MaintenanceInput) {
  assertPermission(user, "inventory:manage");

  await prisma.$transaction(async (tx) => {
    const { article, movements, periods } = await lockArticleStock(tx, articleId);
    if (article.archivedAt) throw new ConflictError("O artigo está arquivado.");

    const period = { start: input.startDate, end: null, quantity: input.quantity };
    const shortage = findShortage(article.stockBase, movements, [...periods, period]);
    if (shortage) {
      const free = totalAt(article.stockBase, movements, shortage.date) - maintenanceAt(periods, shortage.date);
      throw new ConflictError(
        `Só há ${Math.max(0, free)} ${article.unit} livres a ${formatISODate(shortage.date)} (descontando reservas e manutenções).`,
      );
    }

    const maintenance = await tx.maintenance.create({
      data: {
        articleId,
        quantity: input.quantity,
        startDate: isoToDateOnly(input.startDate),
        expectedEndDate: input.expectedEndDate ? isoToDateOnly(input.expectedEndDate) : null,
        reason: input.reason,
        costCents: input.costCents,
        userId: user.id,
      },
    });
    await logAudit(
      {
        actorId: user.id,
        action: "maintenance.create",
        entity: "Article",
        entityId: articleId,
        after: { maintenanceId: maintenance.id, ...input },
      },
      tx,
    );
  });
}

async function getOpenMaintenance(tx: Tx, id: string) {
  const m = await tx.maintenance.findUnique({ where: { id } });
  if (!m) throw new NotFoundError("Manutenção não encontrada.");
  if (!OPEN_STATUSES.includes(m.status as (typeof OPEN_STATUSES)[number])) {
    throw new ConflictError("Esta manutenção já está fechada.");
  }
  return m;
}

export async function startMaintenance(user: CurrentUser, id: string) {
  assertPermission(user, "inventory:manage");
  await prisma.$transaction(async (tx) => {
    const m = await getOpenMaintenance(tx, id);
    if (m.status === "EM_CURSO") return;
    await tx.maintenance.update({ where: { id }, data: { status: "EM_CURSO" } });
    await logAudit(
      { actorId: user.id, action: "maintenance.start", entity: "Article", entityId: m.articleId, after: { maintenanceId: id } },
      tx,
    );
  });
}

/**
 * Fecha uma manutenção: as unidades reparadas voltam ao stock na data de fim;
 * as perdidas saem por um movimento de ABATE ligado a esta manutenção.
 */
export async function completeMaintenance(user: CurrentUser, id: string, input: CompleteMaintenanceInput) {
  assertPermission(user, "inventory:manage");

  await prisma.$transaction(async (tx) => {
    const { articleId } = await getOpenMaintenance(tx, id);
    const { article, movements, periods } = await lockArticleStock(tx, articleId);
    // Relido depois do bloqueio: um fecho simultâneo já terá sido gravado.
    const m = await getOpenMaintenance(tx, id);
    const start = dateOnlyToISO(m.startDate);
    if (input.endDate <= start) throw new ConflictError("A data de fim tem de ser posterior ao início.");
    if (input.lostQuantity > m.quantity) {
      throw new ConflictError(`Só há ${m.quantity} unidades nesta manutenção.`);
    }

    if (input.lostQuantity > 0) {
      const others = periods.filter((p) => p.refId !== id);
      const closed = { start, end: addDaysISO(input.endDate, -1), quantity: m.quantity };
      const shortage = findShortage(
        article.stockBase,
        [...movements, { date: input.endDate, quantity: -input.lostQuantity }],
        [...others, closed],
      );
      if (shortage) throw new ConflictError(shortageMessage(shortage, article.unit));
    }

    const status = input.lostQuantity === m.quantity ? "ABATIDA" : "CONCLUIDA";
    await tx.maintenance.update({
      where: { id },
      data: { status, endDate: isoToDateOnly(input.endDate), costCents: input.costCents ?? m.costCents },
    });
    if (input.lostQuantity > 0) {
      await tx.inventoryMovement.create({
        data: {
          articleId: m.articleId,
          type: "ABATE",
          quantity: -input.lostQuantity,
          effectiveDate: isoToDateOnly(input.endDate),
          reason: `Abate após manutenção: ${m.reason}`,
          userId: user.id,
          maintenanceId: id,
        },
      });
    }
    await logAudit(
      {
        actorId: user.id,
        action: "maintenance.complete",
        entity: "Article",
        entityId: m.articleId,
        after: { maintenanceId: id, status, ...input, repaired: m.quantity - input.lostQuantity },
      },
      tx,
    );
  });
}

/** Anula um registo de manutenção feito por engano (só enquanto está aberto). */
export async function cancelMaintenance(user: CurrentUser, id: string) {
  assertPermission(user, "inventory:manage");
  await prisma.$transaction(async (tx) => {
    await lockArticleStock(tx, (await getOpenMaintenance(tx, id)).articleId);
    const m = await getOpenMaintenance(tx, id);
    await tx.maintenance.delete({ where: { id } });
    await logAudit(
      {
        actorId: user.id,
        action: "maintenance.cancel",
        entity: "Article",
        entityId: m.articleId,
        before: { quantity: m.quantity, reason: m.reason, startDate: dateOnlyToISO(m.startDate) },
      },
      tx,
    );
  });
}

/** Totais para o painel: unidades e artigos em manutenção hoje. */
export async function getMaintenanceSummary() {
  const day = isoToDateOnly(todayISO());
  const rows = await prisma.maintenance.findMany({
    where: { startDate: { lte: day }, OR: [{ endDate: null }, { endDate: { gt: day } }] },
    select: { articleId: true, quantity: true },
  });
  return {
    units: rows.reduce((sum, r) => sum + r.quantity, 0),
    articles: new Set(rows.map((r) => r.articleId)).size,
  };
}
