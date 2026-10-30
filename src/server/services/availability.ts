import "server-only";
import { prisma } from "@/server/db";
import { assertPermission, type CurrentUser } from "@/server/auth/session";
import type { Prisma } from "@/generated/prisma/client";
import {
  OUT_STATUSES,
  blockEnd,
  dailyAvailability,
  rentalOccupancy,
  summarize,
  type Occupancy,
  type RentalStatusKey,
} from "@/lib/availability";
import { addDaysISO, dateOnlyToISO, formatISODate, isoToDateOnly, todayISO } from "@/lib/format";
import type { StockMovement } from "@/lib/inventory";

/**
 * Motor de disponibilidade — a única fonte de verdade (plano §3.1), usado pela
 * página de disponibilidade, pelo calendário, pelas reservas, pelo inventário
 * e, na Fase 5, pela aprovação de orçamentos.
 */

type Db = Prisma.TransactionClient | typeof prisma;

export type ArticleStock = {
  initial: number;
  movements: StockMovement[];
  occupancies: Occupancy[];
};

type ReturnLine = { rentalItemId: string; returned: number; damaged: number };

/** Manutenção fechada a D ocupa até D−1 (convenção em src/lib/inventory.ts). */
export function maintenanceOccupancy(m: {
  id: string;
  startDate: Date;
  endDate: Date | null;
  quantity: number;
}): Occupancy {
  return {
    kind: "maintenance",
    refId: m.id,
    quantity: m.quantity,
    start: dateOnlyToISO(m.startDate),
    end: m.endDate ? addDaysISO(dateOnlyToISO(m.endDate), -1) : null,
  };
}

/**
 * Carrega stock, movimentos e ocupações dos artigos que tocam o período
 * [from, to]. Sem período, carrega tudo (verificações de inventário).
 */
export async function loadArticleStock(
  db: Db,
  articleIds: string[],
  period?: { from: string; to: string },
  options: { excludeRentalId?: string } = {},
): Promise<Map<string, ArticleStock>> {
  const result = new Map<string, ArticleStock>();
  if (articleIds.length === 0) return result;
  const from = period ? isoToDateOnly(period.from) : undefined;
  const to = period ? isoToDateOnly(period.to) : undefined;
  const today = todayISO();

  const [articles, movements, maintenances, rentalItems] = await Promise.all([
    db.article.findMany({ where: { id: { in: articleIds } }, select: { id: true, stockBase: true } }),
    db.inventoryMovement.findMany({
      where: { articleId: { in: articleIds }, ...(to && { effectiveDate: { lte: to } }) },
      select: { articleId: true, effectiveDate: true, quantity: true },
    }),
    db.maintenance.findMany({
      where: {
        articleId: { in: articleIds },
        ...(to && { startDate: { lte: to } }),
        ...(from && { OR: [{ endDate: null }, { endDate: { gt: from } }] }),
      },
      select: { id: true, articleId: true, startDate: true, endDate: true, quantity: true },
    }),
    db.rentalItem.findMany({
      where: {
        articleId: { in: articleIds },
        rental: {
          status: { not: "CANCELADO" },
          ...(options.excludeRentalId && { id: { not: options.excludeRentalId } }),
        },
        ...(to && { blockFrom: { lte: to } }),
        // Alugueres com o cliente podem estar em atraso: ocupam para lá do previsto.
        ...(from && { OR: [{ blockTo: { gte: from } }, { rental: { status: { in: [...OUT_STATUSES] } } }] }),
      },
      select: {
        id: true,
        articleId: true,
        quantity: true,
        prepBufferDays: true,
        rental: {
          select: { id: true, status: true, deliveryDate: true, returnDate: true, returns: { select: { returnedAt: true, lines: true } } },
        },
      },
    }),
  ]);

  for (const a of articles) result.set(a.id, { initial: a.stockBase, movements: [], occupancies: [] });
  for (const m of movements) {
    result.get(m.articleId)?.movements.push({ date: dateOnlyToISO(m.effectiveDate), quantity: m.quantity });
  }
  for (const m of maintenances) result.get(m.articleId)?.occupancies.push(maintenanceOccupancy(m));
  for (const item of rentalItems) {
    const returns = item.rental.returns.flatMap((r) =>
      (r.lines as ReturnLine[])
        .filter((l) => l.rentalItemId === item.id)
        .map((l) => ({ date: dateOnlyToISO(r.returnedAt), returned: l.returned, damaged: l.damaged })),
    );
    result.get(item.articleId)?.occupancies.push(
      ...rentalOccupancy(
        {
          rentalId: item.rental.id,
          status: item.rental.status as RentalStatusKey,
          quantity: item.quantity,
          prepBufferDays: item.prepBufferDays,
          deliveryDate: dateOnlyToISO(item.rental.deliveryDate),
          returnDate: dateOnlyToISO(item.rental.returnDate),
          returns,
        },
        today,
      ),
    );
  }
  return result;
}

export type LineShortage = {
  articleId: string;
  name: string;
  unit: string;
  requested: number;
  available: number;
  date: string;
};

/**
 * Disponível de cada artigo no período em que uma linha de reserva o ocupa
 * (entrega → recolha + dias de preparação da categoria do artigo).
 */
export async function lineAvailability(
  db: Db,
  articleIds: string[],
  deliveryDate: string,
  returnDate: string,
  options: { excludeRentalId?: string } = {},
) {
  const ids = [...new Set(articleIds)];
  const articles = await db.article.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, unit: true, category: { select: { prepBufferDays: true } } },
  });
  const maxBuffer = Math.max(0, ...articles.map((a) => a.category.prepBufferDays));
  const stock = await loadArticleStock(db, ids, { from: deliveryDate, to: blockEnd(returnDate, maxBuffer) }, options);

  return articles.map((article) => {
    const s = stock.get(article.id)!;
    const to = blockEnd(returnDate, article.category.prepBufferDays);
    const summary = summarize(dailyAvailability(s.initial, s.movements, s.occupancies, deliveryDate, to));
    return { articleId: article.id, name: article.name, unit: article.unit, ...summary };
  });
}

/** Linhas sem stock suficiente em algum dia do período (vazio = tudo disponível). */
export async function findLineShortages(
  db: Db,
  lines: { articleId: string; quantity: number }[],
  deliveryDate: string,
  returnDate: string,
  options: { excludeRentalId?: string } = {},
): Promise<LineShortage[]> {
  const availability = await lineAvailability(db, lines.map((l) => l.articleId), deliveryDate, returnDate, options);
  const shortages: LineShortage[] = [];
  for (const a of availability) {
    const requested = lines.filter((l) => l.articleId === a.articleId).reduce((sum, l) => sum + l.quantity, 0);
    if (a.minAvailable < requested) {
      shortages.push({
        articleId: a.articleId,
        name: a.name,
        unit: a.unit,
        requested,
        available: Math.max(0, a.minAvailable),
        date: a.minDate,
      });
    }
  }
  return shortages;
}

export function shortageMessage(s: LineShortage): string {
  return `Faltam ${s.requested - s.available} ${s.unit} de "${s.name}" a ${formatISODate(s.date)} (disponíveis: ${s.available}).`;
}

// ---------------------------------------------------------------------------
// Consultas para as páginas
// ---------------------------------------------------------------------------

export const AVAILABILITY_PAGE_SIZE = 40;

export async function getAvailabilityOverview(
  user: CurrentUser,
  params: { from: string; to: string; q: string; categoria: string; apenas: "todos" | "falta"; pagina: number },
) {
  assertPermission(user, "availability:view");
  const where: Prisma.ArticleWhereInput = { archivedAt: null, status: "ATIVO" };
  if (params.categoria) where.category = { slug: params.categoria };
  if (params.q) {
    const contains = { contains: params.q, mode: "insensitive" as const };
    where.OR = [{ name: contains }, { sku: contains }];
  }
  const articles = await prisma.article.findMany({
    where,
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    select: { id: true, sku: true, name: true, unit: true, category: { select: { name: true } } },
  });
  const stock = await loadArticleStock(prisma, articles.map((a) => a.id), { from: params.from, to: params.to });

  let rows = articles.map((a) => {
    const s = stock.get(a.id)!;
    const days = dailyAvailability(s.initial, s.movements, s.occupancies, params.from, params.to);
    return { ...a, total: days[0]?.total ?? s.initial, ...summarize(days) };
  });
  if (params.apenas === "falta") rows = rows.filter((r) => r.minAvailable <= 0);

  const start = (params.pagina - 1) * AVAILABILITY_PAGE_SIZE;
  return {
    rows: rows.slice(start, start + AVAILABILITY_PAGE_SIZE),
    total: rows.length,
    page: params.pagina,
    pageSize: AVAILABILITY_PAGE_SIZE,
  };
}

/** Grelha dia a dia de um artigo e as reservas/manutenções que o ocupam. */
export async function getArticleAvailability(user: CurrentUser, articleId: string, from: string, to: string) {
  assertPermission(user, "availability:view");
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, sku: true, name: true, unit: true, category: { select: { name: true, prepBufferDays: true } } },
  });
  if (!article) return null;
  const s = (await loadArticleStock(prisma, [articleId], { from, to })).get(articleId)!;
  const days = dailyAvailability(s.initial, s.movements, s.occupancies, from, to);

  const rentalIds = [...new Set(s.occupancies.filter((o) => o.kind === "rental").map((o) => o.refId!))];
  const rentals = await prisma.rental.findMany({
    where: { id: { in: rentalIds } },
    orderBy: { deliveryDate: "asc" },
    select: {
      id: true,
      number: true,
      status: true,
      deliveryDate: true,
      returnDate: true,
      client: { select: { name: true } },
      event: { select: { name: true } },
      items: { where: { articleId }, select: { quantity: true, quantityReturned: true } },
    },
  });
  const maintenances = s.occupancies.filter((o) => o.kind === "maintenance");
  return { article, days, summary: summarize(days), rentals, maintenances };
}
