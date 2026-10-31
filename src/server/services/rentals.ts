import "server-only";
import { prisma } from "@/server/db";
import { assertPermission, type CurrentUser } from "@/server/auth/session";
import { ConflictError, NotFoundError } from "@/server/errors";
import { logAudit } from "@/server/services/audit";
import { findLineShortages, shortageMessage } from "@/server/services/availability";
import { nextDocumentNumber } from "@/server/services/sequences";
import type { Prisma } from "@/generated/prisma/client";
import { blockEnd } from "@/lib/availability";
import { dateOnlyToISO, isoToDateOnly, todayISO } from "@/lib/format";
import {
  CANCELLABLE,
  type RentalInput,
  type RentalListParams,
  type RentalStatus,
  type ReturnInput,
} from "@/lib/validation/rentals";

export const RENTAL_PAGE_SIZE = 25;
const ACTIVE: RentalStatus[] = ["RESERVADO", "CONFLITO_STOCK", "EM_PREPARACAO", "ENTREGUE", "EM_DEVOLUCAO"];

export async function listRentals(user: CurrentUser, params: RentalListParams) {
  assertPermission(user, "rental:view");
  const where: Prisma.RentalWhereInput = {};
  if (params.estado === "ativas") where.status = { in: ACTIVE };
  else if (params.estado !== "todas") where.status = params.estado;
  if (params.q) {
    const contains = { contains: params.q, mode: "insensitive" as const };
    where.OR = [{ number: contains }, { client: { name: contains } }, { event: { name: contains } }];
  }
  const [items, total] = await Promise.all([
    prisma.rental.findMany({
      where,
      orderBy: [{ deliveryDate: params.estado === "ativas" ? "asc" : "desc" }, { number: "asc" }],
      skip: (params.pagina - 1) * RENTAL_PAGE_SIZE,
      take: RENTAL_PAGE_SIZE,
      select: {
        id: true,
        number: true,
        status: true,
        deliveryDate: true,
        returnDate: true,
        client: { select: { name: true } },
        event: { select: { name: true, city: true } },
        _count: { select: { items: true } },
        items: { select: { quantity: true } },
      },
    }),
    prisma.rental.count({ where }),
  ]);
  return { items, total, page: params.pagina, pageSize: RENTAL_PAGE_SIZE };
}

export async function getRental(user: CurrentUser, id: string) {
  assertPermission(user, "rental:view");
  const rental = await prisma.rental.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      event: true,
      createdBy: { select: { name: true } },
      quote: { select: { id: true, number: true } },
      items: {
        orderBy: { article: { name: "asc" } },
        include: { article: { select: { id: true, sku: true, name: true, unit: true } } },
      },
      returns: { orderBy: { createdAt: "asc" }, include: { receivedBy: { select: { name: true } } } },
      maintenances: { select: { id: true, articleId: true, quantity: true, status: true } },
    },
  });
  if (!rental) throw new NotFoundError("Reserva não encontrada.");
  return rental;
}

/** Bloqueia os artigos sempre pela mesma ordem (evita deadlocks entre reservas). */
async function lockArticles(tx: Prisma.TransactionClient, articleIds: string[]) {
  const ids = [...articleIds].sort();
  await tx.$queryRaw`SELECT id FROM articles WHERE id = ANY(${ids}) ORDER BY id FOR UPDATE`;
}

export type ReservationParams = {
  clientId: string;
  eventId: string;
  /** Orçamento de origem (reserva criada pela aprovação). */
  quoteId?: string;
  deliveryDate: string;
  startDate: string;
  endDate: string;
  returnDate: string;
  notes: string | null;
  lines: { articleId: string; quantity: number }[];
  /**
   * O que fazer se faltar stock: recusar (reservas diretas, aprovação interna)
   * ou criar a reserva em "Conflito de stock" (aprovação do cliente no portal, D6).
   */
  onShortage?: "refuse" | "conflict";
};

/**
 * Reserva stock dentro de uma transação já aberta (plano §3.4):
 *  1. bloqueia as linhas dos artigos envolvidos, sempre pela mesma ordem;
 *  2. recalcula a disponibilidade já com o bloqueio;
 *  3. se faltar stock em algum dia, aborta com a mensagem do primeiro problema;
 *  4. cria a reserva e as linhas, e regista a auditoria.
 * Usada pelas reservas diretas e pela aprovação de orçamentos.
 */
export async function reserveInTx(tx: Prisma.TransactionClient, userId: string, params: ReservationParams) {
  const articleIds = params.lines.map((l) => l.articleId);
  await lockArticles(tx, articleIds);

  const articles = await tx.article.findMany({
    where: { id: { in: articleIds } },
    select: { id: true, name: true, status: true, archivedAt: true, category: { select: { prepBufferDays: true } } },
  });
  for (const id of articleIds) {
    const a = articles.find((x) => x.id === id);
    if (!a) throw new ConflictError("Um dos artigos já não existe.");
    if (a.archivedAt || a.status !== "ATIVO") throw new ConflictError(`"${a.name}" não está ativo e não pode ser reservado.`);
  }

  const shortages = await findLineShortages(tx, params.lines, params.deliveryDate, params.returnDate);
  if (shortages.length && params.onShortage !== "conflict") throw new ConflictError(shortageMessage(shortages[0]!));

  const number = await nextDocumentNumber(tx, "RES", Number(params.deliveryDate.slice(0, 4)));
  const rental = await tx.rental.create({
    data: {
      number,
      clientId: params.clientId,
      eventId: params.eventId,
      quoteId: params.quoteId,
      createdById: userId,
      status: shortages.length ? "CONFLITO_STOCK" : "RESERVADO",
      deliveryDate: isoToDateOnly(params.deliveryDate),
      startDate: isoToDateOnly(params.startDate),
      endDate: isoToDateOnly(params.endDate),
      returnDate: isoToDateOnly(params.returnDate),
      notes: params.notes,
      items: {
        create: params.lines.map((l) => {
          const buffer = articles.find((a) => a.id === l.articleId)!.category.prepBufferDays;
          return {
            articleId: l.articleId,
            quantity: l.quantity,
            prepBufferDays: buffer,
            blockFrom: isoToDateOnly(params.deliveryDate),
            blockTo: isoToDateOnly(blockEnd(params.returnDate, buffer)),
          };
        }),
      },
    },
  });
  await logAudit(
    {
      actorId: userId,
      action: "rental.create",
      entity: "Rental",
      entityId: rental.id,
      after: { number, ...params, status: rental.status, shortages: shortages.map(shortageMessage) },
    },
    tx,
  );
  return rental;
}

/**
 * Resolve um conflito de stock (D6): volta a verificar a disponibilidade,
 * sem contar com esta reserva, e passa-a a "Reservado" se já houver stock
 * (ex.: depois de um reforço ou de cancelar outra reserva).
 */
export async function confirmConflict(user: CurrentUser, id: string) {
  assertPermission(user, "rental:manage");
  await prisma.$transaction(
    async (tx) => {
      const rental = await getForUpdate(tx, id);
      if (rental.status !== "CONFLITO_STOCK") throw new ConflictError("Esta reserva não está em conflito de stock.");
      await lockArticles(tx, rental.items.map((i) => i.articleId));
      const shortages = await findLineShortages(
        tx,
        rental.items.map((i) => ({ articleId: i.articleId, quantity: i.quantity })),
        dateOnlyToISO(rental.deliveryDate),
        dateOnlyToISO(rental.returnDate),
        { excludeRentalId: id },
      );
      if (shortages.length) {
        throw new ConflictError(`Ainda não há stock. ${shortages.map(shortageMessage).join(" ")}`);
      }
      await tx.rental.update({ where: { id }, data: { status: "RESERVADO" } });
      await logAudit(
        { actorId: user.id, action: "rental.conflict_resolved", entity: "Rental", entityId: id, before: { status: "CONFLITO_STOCK" }, after: { status: "RESERVADO" } },
        tx,
      );
    },
    { timeout: 20_000 },
  );
}

/** Cria uma reserva direta (sem orçamento). */
export async function createRental(user: CurrentUser, input: RentalInput) {
  assertPermission(user, "rental:manage");

  const client = await prisma.client.findUnique({ where: { id: input.clientId }, select: { archivedAt: true } });
  if (!client || client.archivedAt) throw new ConflictError("Escolha um cliente ativo.");

  return prisma.$transaction(
    async (tx) => {
      const event = await tx.event.create({
        data: { clientId: input.clientId, name: input.eventName, venue: input.venue, city: input.city },
      });
      return reserveInTx(tx, user.id, { ...input, eventId: event.id });
    },
    { timeout: 20_000 },
  );
}

async function getForUpdate(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM rentals WHERE id = ${id} FOR UPDATE`;
  const rental = await tx.rental.findUnique({ where: { id }, include: { items: true } });
  if (!rental) throw new NotFoundError("Reserva não encontrada.");
  return rental;
}

async function changeStatus(
  user: CurrentUser,
  id: string,
  allowed: RentalStatus[],
  next: RentalStatus,
  action: string,
  extra: Prisma.RentalUpdateInput = {},
) {
  assertPermission(user, "rental:manage");
  await prisma.$transaction(async (tx) => {
    const rental = await getForUpdate(tx, id);
    if (!allowed.includes(rental.status as RentalStatus)) {
      throw new ConflictError("Esta operação não é possível no estado atual da reserva.");
    }
    await tx.rental.update({ where: { id }, data: { status: next, ...extra } });
    await logAudit(
      { actorId: user.id, action, entity: "Rental", entityId: id, before: { status: rental.status }, after: { status: next } },
      tx,
    );
  });
}

export function startPreparation(user: CurrentUser, id: string) {
  return changeStatus(user, id, ["RESERVADO"], "EM_PREPARACAO", "rental.prepare");
}

/** Reserva em conflito de stock não sai sem o conflito estar resolvido. */
export async function markDelivered(user: CurrentUser, id: string, date: string) {
  if (date > todayISO()) throw new ConflictError("A entrega não pode ter data futura.");
  return changeStatus(user, id, ["RESERVADO", "EM_PREPARACAO"], "ENTREGUE", "rental.deliver", {
    actualDeliveryDate: isoToDateOnly(date),
  });
}

export function cancelRental(user: CurrentUser, id: string) {
  return changeStatus(user, id, [...CANCELLABLE], "CANCELADO", "rental.cancel", { cancelledAt: new Date() });
}

/**
 * Regista uma devolução (total ou parcial). Unidades danificadas entram
 * automaticamente em manutenção a partir da data da devolução.
 */
export async function registerReturn(user: CurrentUser, id: string, input: ReturnInput) {
  assertPermission(user, "rental:manage");

  await prisma.$transaction(async (tx) => {
    const rental = await getForUpdate(tx, id);
    if (rental.status !== "ENTREGUE" && rental.status !== "EM_DEVOLUCAO") {
      throw new ConflictError("Só é possível registar devoluções de material entregue.");
    }
    const delivered = rental.actualDeliveryDate ? dateOnlyToISO(rental.actualDeliveryDate) : dateOnlyToISO(rental.deliveryDate);
    if (input.date < delivered) throw new ConflictError("A devolução não pode ser anterior à entrega.");
    if (input.date > todayISO()) throw new ConflictError("A devolução não pode ter data futura.");

    const lines = input.lines.filter((l) => l.returned > 0);
    for (const line of lines) {
      const item = rental.items.find((i) => i.id === line.rentalItemId);
      if (!item) throw new ConflictError("Linha da reserva inválida.");
      const pending = item.quantity - item.quantityReturned;
      if (line.returned > pending) throw new ConflictError(`Só faltam devolver ${pending} unidades de uma das linhas.`);
    }

    await tx.rentalReturn.create({
      data: { rentalId: id, returnedAt: isoToDateOnly(input.date), receivedById: user.id, lines, notes: input.notes },
    });
    for (const line of lines) {
      const item = rental.items.find((i) => i.id === line.rentalItemId)!;
      await tx.rentalItem.update({
        where: { id: item.id },
        data: { quantityReturned: { increment: line.returned }, quantityDamaged: { increment: line.damaged } },
      });
      if (line.damaged > 0) {
        await tx.maintenance.create({
          data: {
            articleId: item.articleId,
            quantity: line.damaged,
            startDate: isoToDateOnly(input.date),
            reason: `Danificado no aluguer ${rental.number}`,
            rentalId: id,
            userId: user.id,
          },
        });
      }
    }

    const allReturned = rental.items.every((item) => {
      const now = lines.find((l) => l.rentalItemId === item.id)?.returned ?? 0;
      return item.quantityReturned + now >= item.quantity;
    });
    await tx.rental.update({
      where: { id },
      data: allReturned
        ? { status: "DEVOLVIDO", actualReturnDate: isoToDateOnly(input.date) }
        : { status: "EM_DEVOLUCAO" },
    });
    await logAudit(
      { actorId: user.id, action: "rental.return", entity: "Rental", entityId: id, after: { ...input, lines, complete: allReturned } },
      tx,
    );
  });
}

// ---------------------------------------------------------------------------
// Calendário e painel
// ---------------------------------------------------------------------------

export async function listCalendarRentals(user: CurrentUser, from: string, to: string, statuses: RentalStatus[]) {
  assertPermission(user, "calendar:view");
  return prisma.rental.findMany({
    where: {
      status: { in: statuses },
      deliveryDate: { lte: isoToDateOnly(to) },
      // Alugueres em atraso continuam visíveis até serem devolvidos.
      OR: [{ returnDate: { gte: isoToDateOnly(from) } }, { status: { in: ["ENTREGUE", "EM_DEVOLUCAO"] } }],
    },
    orderBy: { deliveryDate: "asc" },
    select: {
      id: true,
      number: true,
      status: true,
      deliveryDate: true,
      returnDate: true,
      client: { select: { name: true } },
      event: { select: { name: true, city: true } },
    },
  });
}

/** Operação dos próximos dias para o painel. */
export async function getOperationsSummary(days = 7) {
  const today = todayISO();
  const until = isoToDateOnly(new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10));
  const todayDate = isoToDateOnly(today);
  const select = {
    id: true,
    number: true,
    status: true,
    deliveryDate: true,
    returnDate: true,
    client: { select: { name: true } },
    event: { select: { name: true } },
  } as const;

  const [deliveries, returns, overdue, out, conflicts] = await Promise.all([
    prisma.rental.findMany({
      where: { status: { in: ["RESERVADO", "EM_PREPARACAO", "CONFLITO_STOCK"] }, deliveryDate: { lte: until } },
      orderBy: { deliveryDate: "asc" },
      take: 8,
      select,
    }),
    prisma.rental.findMany({
      where: { status: { in: ["ENTREGUE", "EM_DEVOLUCAO"] }, returnDate: { gte: todayDate, lte: until } },
      orderBy: { returnDate: "asc" },
      take: 8,
      select,
    }),
    prisma.rental.findMany({
      where: { status: { in: ["ENTREGUE", "EM_DEVOLUCAO"] }, returnDate: { lt: todayDate } },
      orderBy: { returnDate: "asc" },
      take: 8,
      select,
    }),
    prisma.rentalItem.findMany({
      where: { rental: { status: { in: ["ENTREGUE", "EM_DEVOLUCAO"] } } },
      select: { quantity: true, quantityReturned: true },
    }),
    prisma.rental.count({ where: { status: "CONFLITO_STOCK" } }),
  ]);

  return {
    deliveries,
    returns,
    overdue,
    unitsOut: out.reduce((s, i) => s + i.quantity - i.quantityReturned, 0),
    conflicts,
  };
}
