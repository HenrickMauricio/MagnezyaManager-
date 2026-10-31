import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/server/db";
import { assertPermission, type CurrentUser } from "@/server/auth/session";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { logAudit } from "@/server/services/audit";
import { clientIp } from "@/server/services/login-throttle";
import { reserveInTx } from "@/server/services/rentals";
import { expireQuotes } from "@/server/services/quotes";
import { getObject } from "@/server/services/storage";
import type { Prisma } from "@/generated/prisma/client";
import { dateOnlyToISO, isoToDateOnly, todayISO } from "@/lib/format";
import type { QuoteSnapshot } from "@/lib/quote-snapshot";

/**
 * Portal do cliente. TODAS as queries são filtradas pelo clientId da sessão —
 * nunca por um id vindo do browser. Um registo de outro cliente responde
 * "não encontrado" (não "proibido"), para não revelar que existe.
 */

function clientIdOf(user: CurrentUser): string {
  assertPermission(user, "portal:access");
  if (!user.clientId) throw new ForbiddenError();
  return user.clientId;
}

/** Só orçamentos já emitidos pelo menos uma vez (rascunhos internos nunca aparecem). */
const visibleQuote = (clientId: string): Prisma.QuoteWhereInput => ({ clientId, currentVersion: { gt: 0 } });

/** Estado tal como o cliente o vê. */
export type PortalQuoteState = "PENDENTE" | "EM_REVISAO" | "APROVADA" | "RECUSADA" | "EXPIRADA" | "CANCELADA";

export function portalState(status: string, validUntil: Date): PortalQuoteState {
  if (status === "APROVADO") return "APROVADA";
  if (status === "REJEITADO") return "RECUSADA";
  if (status === "CANCELADO") return "CANCELADA";
  if (status === "EXPIRADO") return "EXPIRADA";
  if (status === "ENVIADO") return dateOnlyToISO(validUntil) < todayISO() ? "EXPIRADA" : "PENDENTE";
  return "EM_REVISAO"; // rascunho ou aguarda aprovação interna depois de já ter sido emitido
}

/** Última versão emitida (número, total e data). */
const latestVersion = {
  orderBy: { versionNumber: "desc" as const },
  take: 1,
  select: { versionNumber: true, totalCents: true, issuedAt: true },
};

export async function getPortalOverview(user: CurrentUser) {
  const clientId = clientIdOf(user);
  await expireQuotes();
  const today = isoToDateOnly(todayISO());
  const [client, pending, total, upcoming] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { name: true, email: true, phone: true, city: true } }),
    prisma.quote.findMany({
      where: { ...visibleQuote(clientId), status: "ENVIADO", validUntil: { gte: today } },
      orderBy: { validUntil: "asc" },
      select: { id: true, number: true, validUntil: true, startDate: true, event: { select: { name: true } }, versions: latestVersion },
    }),
    prisma.quote.count({ where: visibleQuote(clientId) }),
    prisma.rental.findMany({
      where: { clientId, status: { not: "CANCELADO" }, returnDate: { gte: today } },
      orderBy: { deliveryDate: "asc" },
      take: 5,
      select: { id: true, number: true, status: true, deliveryDate: true, returnDate: true, event: { select: { name: true } } },
    }),
  ]);
  return { client, pending, total, upcoming };
}

/** Nº de propostas à espera de resposta (distintivo do menu). */
export async function countPendingProposals(user: CurrentUser) {
  const clientId = clientIdOf(user);
  return prisma.quote.count({
    where: { ...visibleQuote(clientId), status: "ENVIADO", validUntil: { gte: isoToDateOnly(todayISO()) } },
  });
}

export async function listPortalQuotes(user: CurrentUser) {
  const clientId = clientIdOf(user);
  await expireQuotes();
  const quotes = await prisma.quote.findMany({
    where: visibleQuote(clientId),
    orderBy: { sentAt: { sort: "desc", nulls: "last" } },
    select: {
      id: true,
      number: true,
      status: true,
      validUntil: true,
      startDate: true,
      endDate: true,
      event: { select: { name: true } },
      versions: latestVersion,
    },
  });
  return quotes.map((q) => ({ ...q, state: portalState(q.status, q.validUntil) }));
}

/** Proposta tal como foi emitida (última versão), com o histórico de versões. */
export async function getPortalQuote(user: CurrentUser, id: string) {
  const clientId = clientIdOf(user);
  await expireQuotes();
  const quote = await prisma.quote.findFirst({
    where: { id, ...visibleQuote(clientId) },
    select: {
      id: true,
      number: true,
      status: true,
      validUntil: true,
      currentVersion: true,
      approvedAt: true,
      approvedVersion: true,
      approvedBy: { select: { name: true } },
      rejectedAt: true,
      rejectedReason: true,
      rejectedBy: { select: { name: true } },
      rental: { select: { id: true, number: true, status: true } },
      versions: { orderBy: { versionNumber: "desc" }, select: { versionNumber: true, issuedAt: true, totalCents: true, snapshot: true } },
    },
  });
  if (!quote) throw new NotFoundError("Proposta não encontrada.");
  const [latest] = quote.versions;
  return {
    ...quote,
    state: portalState(quote.status, quote.validUntil),
    snapshot: latest!.snapshot as unknown as QuoteSnapshot,
    versions: quote.versions.map(({ versionNumber, issuedAt, totalCents }) => ({ versionNumber, issuedAt, totalCents })),
  };
}

/** PDF guardado de uma versão — só de propostas do próprio cliente. */
export async function getPortalPdf(user: CurrentUser, id: string, versionNumber?: number) {
  const clientId = clientIdOf(user);
  const version = await prisma.quoteVersion.findFirst({
    where: { quote: { id, ...visibleQuote(clientId) }, ...(versionNumber ? { versionNumber } : {}) },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true, pdfStorageKey: true, pdfSha256: true, quote: { select: { number: true } } },
  });
  if (!version?.pdfStorageKey) throw new NotFoundError("Proposta não encontrada.");
  const pdf = await getObject(version.pdfStorageKey);
  if (!pdf) throw new NotFoundError("O ficheiro PDF não está disponível. Contacte-nos.");
  if (version.pdfSha256 && createHash("sha256").update(pdf).digest("hex") !== version.pdfSha256) {
    throw new ConflictError("O ficheiro PDF não corresponde ao original. Contacte-nos.");
  }
  return { pdf, filename: `${version.quote.number}-v${version.versionNumber}.pdf` };
}

export type PortalResponse =
  | { decision: "approve"; version: number; acceptTerms: boolean }
  | { decision: "reject"; version: number; reason: string | null };

/**
 * Resposta do cliente a uma proposta. Fica registado quem respondeu, quando,
 * de que IP e a que versão. Aprovar reserva o stock; se já não houver, a
 * reserva fica em "Conflito de stock" e a equipa resolve (D6).
 */
export async function respondToQuote(user: CurrentUser, id: string, response: PortalResponse) {
  const clientId = clientIdOf(user);
  assertPermission(user, "portal:quote_respond");
  if (response.decision === "approve" && !response.acceptTerms) {
    throw new ConflictError("Para aprovar, aceite as condições da proposta.");
  }
  const ip = await clientIp();

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM quotes WHERE id = ${id} FOR UPDATE`;
      const quote = await tx.quote.findFirst({ where: { id, ...visibleQuote(clientId) }, include: { items: true } });
      if (!quote) throw new NotFoundError("Proposta não encontrada.");
      const state = portalState(quote.status, quote.validUntil);
      if (state === "EXPIRADA") throw new ConflictError("Esta proposta expirou. Contacte-nos para receber uma proposta atualizada.");
      if (state !== "PENDENTE") throw new ConflictError("Esta proposta já não está a aguardar resposta.");
      if (response.version !== quote.currentVersion) {
        throw new ConflictError(`A proposta foi atualizada para a versão ${quote.currentVersion}. Reveja-a antes de responder.`);
      }

      if (response.decision === "reject") {
        await tx.quote.update({
          where: { id },
          data: {
            status: "REJEITADO",
            rejectedAt: new Date(),
            rejectedReason: response.reason,
            rejectedById: user.id,
            rejectedVia: "PORTAL",
            rejectionIp: ip,
            lockVersion: { increment: 1 },
          },
        });
        await logAudit(
          { actorId: user.id, action: "quote.portal_reject", entity: "Quote", entityId: id, after: { version: response.version, reason: response.reason } },
          tx,
        );
        return { decision: "reject" as const, rental: null };
      }

      const rental = await reserveInTx(tx, user.id, {
        clientId,
        eventId: quote.eventId,
        quoteId: id,
        deliveryDate: dateOnlyToISO(quote.deliveryDate),
        startDate: dateOnlyToISO(quote.startDate),
        endDate: dateOnlyToISO(quote.endDate),
        returnDate: dateOnlyToISO(quote.returnDate),
        notes: quote.notes,
        lines: quote.items.map((i) => ({ articleId: i.articleId, quantity: i.quantity })),
        onShortage: "conflict",
      });
      await tx.quote.update({
        where: { id },
        data: {
          status: "APROVADO",
          approvedAt: new Date(),
          approvedById: user.id,
          approvedVia: "PORTAL",
          approvalIp: ip,
          approvedVersion: response.version,
          lockVersion: { increment: 1 },
        },
      });
      await logAudit(
        {
          actorId: user.id,
          action: "quote.portal_approve",
          entity: "Quote",
          entityId: id,
          after: { version: response.version, rental: rental.number, conflict: rental.status === "CONFLITO_STOCK" },
        },
        tx,
      );
      return { decision: "approve" as const, rental };
    },
    { timeout: 20_000 },
  );
}

// ---------------------------------------------------------------------------
// Reservas e conta
// ---------------------------------------------------------------------------

export async function listPortalRentals(user: CurrentUser) {
  const clientId = clientIdOf(user);
  return prisma.rental.findMany({
    where: { clientId, status: { not: "CANCELADO" } },
    orderBy: { deliveryDate: "desc" },
    select: {
      id: true,
      number: true,
      status: true,
      deliveryDate: true,
      startDate: true,
      endDate: true,
      returnDate: true,
      event: { select: { name: true, venue: true, city: true } },
      quote: { select: { id: true, number: true } },
      items: {
        orderBy: { article: { name: "asc" } },
        select: { quantity: true, quantityReturned: true, article: { select: { name: true, unit: true } } },
      },
    },
  });
}

export async function getPortalAccount(user: CurrentUser) {
  const clientId = clientIdOf(user);
  return prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    select: {
      name: true,
      nif: true,
      email: true,
      phone: true,
      billingAddress: true,
      postalCode: true,
      city: true,
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }], select: { name: true, jobTitle: true, email: true, phone: true, isPrimary: true } },
    },
  });
}
