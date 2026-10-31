import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/server/db";
import { assertPermission, type CurrentUser } from "@/server/auth/session";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { logAudit } from "@/server/services/audit";
import { reserveInTx } from "@/server/services/rentals";
import { nextDocumentNumber } from "@/server/services/sequences";
import { getCompanySettings } from "@/server/services/settings";
import { deleteObject, getObject, putObject } from "@/server/services/storage";
import { renderQuotePdf } from "@/server/pdf/quote-pdf";
import type { Prisma } from "@/generated/prisma/client";
import { canEditQuote } from "@/lib/permissions";
import { addDaysISO, dateOnlyToISO, isoToDateOnly, todayISO } from "@/lib/format";
import { billableDaysBetween, computeTotals, type PriceUnit } from "@/lib/pricing";
import type { QuoteSnapshot } from "@/lib/quote-snapshot";
import {
  EDITABLE_STATUSES,
  OPEN_STATUSES,
  type QuoteInput,
  type QuoteListParams,
  type QuoteStatus,
} from "@/lib/validation/quotes";

type Db = Prisma.TransactionClient | typeof prisma;

export const QUOTE_PAGE_SIZE = 25;

/** Orçamentos emitidos fora da validade passam a "Expirado" (verificado ao listar e ao abrir). */
export async function expireQuotes() {
  await prisma.quote.updateMany({
    where: { status: "ENVIADO", validUntil: { lt: isoToDateOnly(todayISO()) } },
    data: { status: "EXPIRADO" },
  });
}

export async function listQuotes(user: CurrentUser, params: QuoteListParams) {
  assertPermission(user, "quote:view");
  await expireQuotes();
  const where: Prisma.QuoteWhereInput = {};
  if (params.estado === "abertos") where.status = { in: [...OPEN_STATUSES] };
  else if (params.estado !== "todos") where.status = params.estado;
  if (params.autor === "meus") where.createdById = user.id;
  if (params.q) {
    const contains = { contains: params.q, mode: "insensitive" as const };
    where.OR = [{ number: contains }, { client: { name: contains } }, { event: { name: contains } }];
  }
  const [items, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (params.pagina - 1) * QUOTE_PAGE_SIZE,
      take: QUOTE_PAGE_SIZE,
      select: {
        id: true,
        number: true,
        status: true,
        startDate: true,
        endDate: true,
        validUntil: true,
        totalCents: true,
        currentVersion: true,
        client: { select: { name: true } },
        event: { select: { name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.quote.count({ where }),
  ]);
  return { items, total, page: params.pagina, pageSize: QUOTE_PAGE_SIZE };
}

export async function getQuote(user: CurrentUser, id: string) {
  assertPermission(user, "quote:view");
  await expireQuotes();
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, nif: true } },
      event: true,
      createdBy: { select: { id: true, name: true } },
      internalApprovedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          article: {
            select: {
              id: true,
              unit: true,
              status: true,
              archivedAt: true,
              images: { where: { isPrimary: true }, take: 1, select: { storageKey: true } },
            },
          },
        },
      },
      services: { orderBy: { sortOrder: "asc" } },
      versions: {
        orderBy: { versionNumber: "desc" },
        select: { id: true, versionNumber: true, totalCents: true, issuedAt: true, issuedBy: { select: { name: true } } },
      },
      rental: { select: { id: true, number: true, status: true } },
    },
  });
  if (!quote) throw new NotFoundError("Orçamento não encontrado.");
  return quote;
}

function assertCanEdit(user: CurrentUser, quote: { createdById: string }) {
  if (!canEditQuote(user, quote)) {
    throw new ForbiddenError("Só pode alterar os seus próprios orçamentos.");
  }
}

/** Taxa de IVA por omissão (para serviços escritos à mão). */
async function defaultTaxRate(db: Db) {
  const settings = await getCompanySettings();
  const tax =
    (settings.defaultTaxRateId && (await db.taxRate.findUnique({ where: { id: settings.defaultTaxRateId } }))) ||
    (await db.taxRate.findFirst({ where: { isDefault: true } })) ||
    (await db.taxRate.findFirst({ where: { active: true }, orderBy: { rateBp: "desc" } }));
  if (!tax) throw new ConflictError("Configure pelo menos uma taxa de IVA.");
  return tax;
}

/**
 * Linhas e totais calculados no servidor. Preços dos artigos vêm do catálogo;
 * numa edição, um artigo que já estava no orçamento mantém o preço com que
 * foi adicionado (snapshot).
 */
async function buildLines(
  db: Db,
  input: QuoteInput,
  previous: { articleId: string; unitPriceCents: number; priceUnit: PriceUnit }[] = [],
) {
  const articles = await db.article.findMany({
    where: { id: { in: input.items.map((i) => i.articleId) } },
    select: {
      id: true,
      sku: true,
      name: true,
      status: true,
      archivedAt: true,
      priceCents: true,
      priceUnit: true,
      taxRate: { select: { rateBp: true, exemptionCode: true } },
    },
  });
  const days = billableDaysBetween(input.startDate, input.endDate);

  const items = input.items.map((line, index) => {
    const article = articles.find((a) => a.id === line.articleId);
    if (!article) throw new ConflictError("Um dos artigos já não existe.");
    const kept = previous.find((p) => p.articleId === article.id);
    if (!kept && (article.archivedAt || article.status !== "ATIVO")) {
      throw new ConflictError(`"${article.name}" não está ativo e não pode ser adicionado.`);
    }
    return {
      articleId: article.id,
      quantity: line.quantity,
      unitPriceCents: kept?.unitPriceCents ?? article.priceCents,
      priceUnit: kept?.priceUnit ?? article.priceUnit,
      billableDays: days,
      discountBp: line.discountBp,
      taxRateBp: article.taxRate.rateBp,
      taxExemptionCode: article.taxRate.exemptionCode,
      nameSnapshot: article.name,
      skuSnapshot: article.sku,
      sortOrder: index,
    };
  });

  const serviceIds = input.services.map((s) => s.serviceId).filter((x): x is string => !!x);
  const catalogServices = await db.additionalService.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, taxRate: { select: { rateBp: true, exemptionCode: true } } },
  });
  const fallbackTax = input.services.some((s) => !s.serviceId) ? await defaultTaxRate(db) : null;
  const services = input.services.map((s, index) => {
    const tax = catalogServices.find((c) => c.id === s.serviceId)?.taxRate ?? fallbackTax!;
    return {
      serviceId: s.serviceId,
      description: s.description,
      quantity: s.quantity,
      unitPriceCents: s.price,
      taxRateBp: tax.rateBp,
      taxExemptionCode: tax.exemptionCode,
      sortOrder: index,
    };
  });

  const totals = computeTotals(items, services, input.discount);
  return {
    items: items.map((item, i) => ({ ...item, lineTotalCents: totals.itemTotals[i]! })),
    services: services.map((svc, i) => ({ ...svc, lineTotalCents: totals.serviceTotals[i]! })),
    totals,
  };
}

function quoteFields(input: QuoteInput, totals: ReturnType<typeof computeTotals>) {
  return {
    clientId: input.clientId,
    deliveryDate: isoToDateOnly(input.deliveryDate),
    startDate: isoToDateOnly(input.startDate),
    endDate: isoToDateOnly(input.endDate),
    returnDate: isoToDateOnly(input.returnDate),
    validUntil: isoToDateOnly(input.validUntil),
    discountBp: input.discount,
    notes: input.notes,
    internalNotes: input.internalNotes,
    terms: input.terms,
    subtotalCents: totals.subtotalCents,
    discountCents: totals.discountCents,
    servicesCents: totals.servicesCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
  };
}

async function assertActiveClient(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { archivedAt: true } });
  if (!client || client.archivedAt) throw new ConflictError("Escolha um cliente ativo.");
}

export async function createQuote(user: CurrentUser, input: QuoteInput) {
  assertPermission(user, "quote:create");
  await assertActiveClient(input.clientId);
  const settings = await getCompanySettings();

  return prisma.$transaction(
    async (tx) => {
      const { items, services, totals } = await buildLines(tx, input);
      const event = await tx.event.create({
        data: { clientId: input.clientId, name: input.eventName, venue: input.venue, city: input.city },
      });
      const number = await nextDocumentNumber(tx, settings.quotePrefix, Number(todayISO().slice(0, 4)));
      const quote = await tx.quote.create({
        data: {
          ...quoteFields(input, totals),
          number,
          eventId: event.id,
          createdById: user.id,
          items: { create: items },
          services: { create: services },
        },
      });
      await logAudit(
        { actorId: user.id, action: "quote.create", entity: "Quote", entityId: quote.id, after: { number, totalCents: totals.totalCents } },
        tx,
      );
      return quote;
    },
    { timeout: 20_000 },
  );
}

async function lockQuote(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM quotes WHERE id = ${id} FOR UPDATE`;
  const quote = await tx.quote.findUnique({ where: { id }, include: { items: true } });
  if (!quote) throw new NotFoundError("Orçamento não encontrado.");
  return quote;
}

/**
 * Grava alterações. Um orçamento emitido ou expirado volta a rascunho (a
 * próxima emissão cria uma nova versão); a aprovação interna de desconto
 * deixa de valer.
 */
export async function updateQuote(user: CurrentUser, id: string, input: QuoteInput) {
  assertPermission(user, "quote:view");
  await assertActiveClient(input.clientId);

  await prisma.$transaction(
    async (tx) => {
      const before = await lockQuote(tx, id);
      assertCanEdit(user, before);
      if (!EDITABLE_STATUSES.includes(before.status as QuoteStatus)) {
        throw new ConflictError("Este orçamento já não pode ser alterado.");
      }
      if (input.lockVersion !== undefined && input.lockVersion !== before.lockVersion) {
        throw new ConflictError("Este orçamento foi alterado por outra pessoa. Recarregue a página para ver a versão atual.");
      }
      const { items, services, totals } = await buildLines(tx, input, before.items);
      await tx.event.update({
        where: { id: before.eventId },
        data: { clientId: input.clientId, name: input.eventName, venue: input.venue, city: input.city },
      });
      await tx.quoteItem.deleteMany({ where: { quoteId: id } });
      await tx.quoteService.deleteMany({ where: { quoteId: id } });
      await tx.quote.update({
        where: { id },
        data: {
          ...quoteFields(input, totals),
          status: "RASCUNHO",
          internalApprovedAt: null,
          internalApprovedById: null,
          lockVersion: { increment: 1 },
          items: { create: items },
          services: { create: services },
        },
      });
      await logAudit(
        {
          actorId: user.id,
          action: "quote.update",
          entity: "Quote",
          entityId: id,
          before: { status: before.status, totalCents: before.totalCents },
          after: { totalCents: totals.totalCents },
        },
        tx,
      );
    },
    { timeout: 20_000 },
  );
}

/** Snapshot imutável do estado atual do orçamento (para emitir ou pré-visualizar). */
async function buildSnapshot(db: Db, id: string, meta: { version: number; issuedBy: string | null }): Promise<QuoteSnapshot> {
  const [quote, company] = await Promise.all([
    db.quote.findUniqueOrThrow({
      where: { id },
      include: {
        client: { include: { contacts: { where: { isPrimary: true }, take: 1 } } },
        event: true,
        items: {
          orderBy: { sortOrder: "asc" },
          include: { article: { select: { unit: true, images: { where: { isPrimary: true }, take: 1, select: { storageKey: true } } } } },
        },
        services: { orderBy: { sortOrder: "asc" } },
      },
    }),
    getCompanySettings(),
  ]);
  const totals = computeTotals(quote.items, quote.services, quote.discountBp);
  const contact = quote.client.contacts[0];
  const start = dateOnlyToISO(quote.startDate);
  const end = dateOnlyToISO(quote.endDate);

  return {
    schemaVersion: 1,
    number: quote.number,
    version: meta.version,
    issuedAt: new Date().toISOString(),
    issuedBy: meta.issuedBy,
    company: {
      legalName: company.legalName,
      tradeName: company.tradeName,
      nif: company.nif,
      address: company.address,
      postalCode: company.postalCode,
      city: company.city,
      country: company.country,
      phone: company.phone,
      email: company.email,
      website: company.website,
      iban: company.iban,
      logoKey: company.logoKey,
    },
    client: {
      name: quote.client.name,
      nif: quote.client.nif,
      email: quote.client.email,
      phone: quote.client.phone,
      address: quote.client.billingAddress,
      postalCode: quote.client.postalCode,
      city: quote.client.city,
      country: quote.client.country,
    },
    contact: contact ? { name: contact.name, email: contact.email, phone: contact.phone } : null,
    event: { name: quote.event.name, venue: quote.event.venue, city: quote.event.city },
    dates: { delivery: dateOnlyToISO(quote.deliveryDate), start, end, return: dateOnlyToISO(quote.returnDate) },
    billableDays: billableDaysBetween(start, end),
    validUntil: dateOnlyToISO(quote.validUntil),
    items: quote.items.map((item, i) => ({
      sku: item.skuSnapshot,
      name: item.nameSnapshot,
      unit: item.article.unit,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      priceUnit: item.priceUnit,
      billableDays: item.billableDays,
      discountBp: item.discountBp,
      taxRateBp: item.taxRateBp,
      totalCents: totals.itemTotals[i]!,
      imageKey: item.article.images[0]?.storageKey ?? null,
    })),
    services: quote.services.map((svc, i) => ({
      description: svc.description,
      quantity: svc.quantity,
      unitPriceCents: svc.unitPriceCents,
      taxRateBp: svc.taxRateBp,
      totalCents: totals.serviceTotals[i]!,
    })),
    globalDiscountBp: quote.discountBp,
    totals: {
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      servicesCents: totals.servicesCents,
      taxLines: totals.taxLines,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
    },
    notes: quote.notes,
    terms: quote.terms,
  };
}

export type IssueResult = { status: "ENVIADO"; version: number } | { status: "AGUARDANDO_APROVACAO"; discountBp: number };

/**
 * Emite o orçamento: congela uma nova versão (snapshot + PDF guardado com
 * hash). Se o desconto exceder o limite de quem emite e ninguém o aprovou,
 * o orçamento fica a aguardar aprovação interna (D4).
 */
export async function issueQuote(user: CurrentUser, id: string): Promise<IssueResult> {
  assertPermission(user, "quote:send");
  let storedKey: string | null = null;
  try {
    return await prisma.$transaction(
      async (tx) => {
        const quote = await lockQuote(tx, id);
        assertCanEdit(user, quote);
        if (quote.status !== "RASCUNHO") throw new ConflictError("Só é possível emitir um orçamento em rascunho.");
        if (quote.items.length === 0) throw new ConflictError("Adicione pelo menos um artigo antes de emitir.");
        if (dateOnlyToISO(quote.validUntil) < todayISO()) {
          throw new ConflictError("A validade do orçamento já passou. Edite-o e escolha uma nova data.");
        }

        const { effectiveDiscountBp } = computeTotals(quote.items, [], quote.discountBp);
        const allowed = user.permissions.has("quote:approve_internal") || quote.internalApprovedAt !== null;
        if (!allowed && effectiveDiscountBp > user.maxDiscountBp) {
          await tx.quote.update({ where: { id }, data: { status: "AGUARDANDO_APROVACAO" } });
          await logAudit(
            { actorId: user.id, action: "quote.approval_requested", entity: "Quote", entityId: id, after: { effectiveDiscountBp } },
            tx,
          );
          return { status: "AGUARDANDO_APROVACAO" as const, discountBp: effectiveDiscountBp };
        }

        const version = quote.currentVersion + 1;
        const snapshot = await buildSnapshot(tx, id, { version, issuedBy: user.name });
        const pdf = await renderQuotePdf(snapshot);
        storedKey = `quotes/${id.toLowerCase()}/${quote.number.toLowerCase()}-v${version}-${crypto.randomUUID()}.pdf`;
        await putObject(storedKey, pdf);

        await tx.quoteVersion.create({
          data: {
            quoteId: id,
            versionNumber: version,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
            totalCents: snapshot.totals.totalCents,
            pdfStorageKey: storedKey,
            pdfSha256: createHash("sha256").update(pdf).digest("hex"),
            issuedById: user.id,
          },
        });
        await tx.quote.update({
          where: { id },
          data: { status: "ENVIADO", sentAt: new Date(), currentVersion: version, lockVersion: { increment: 1 } },
        });
        await logAudit(
          { actorId: user.id, action: "quote.issue", entity: "Quote", entityId: id, after: { version, totalCents: snapshot.totals.totalCents } },
          tx,
        );
        return { status: "ENVIADO" as const, version };
      },
      { timeout: 30_000 },
    );
  } catch (err) {
    if (storedKey) await deleteObject(storedKey).catch(() => undefined);
    throw err;
  }
}

/** Aprovação interna do desconto (D4) seguida da emissão. */
export async function approveDiscountAndIssue(user: CurrentUser, id: string) {
  assertPermission(user, "quote:approve_internal");
  await prisma.$transaction(async (tx) => {
    const quote = await lockQuote(tx, id);
    if (quote.status !== "AGUARDANDO_APROVACAO") throw new ConflictError("Este orçamento não está a aguardar aprovação.");
    await tx.quote.update({
      where: { id },
      data: { status: "RASCUNHO", internalApprovedAt: new Date(), internalApprovedById: user.id },
    });
    await logAudit({ actorId: user.id, action: "quote.discount_approved", entity: "Quote", entityId: id }, tx);
  });
  return issueQuote(user, id);
}

/**
 * Regista a aceitação do cliente e reserva o stock. Se entretanto faltar
 * stock, a aprovação é recusada com a mensagem do primeiro problema
 * (critério da Fase 5) e o orçamento mantém-se emitido.
 */
export async function approveQuote(user: CurrentUser, id: string) {
  assertPermission(user, "quote:view");
  return prisma.$transaction(
    async (tx) => {
      const quote = await lockQuote(tx, id);
      assertCanEdit(user, quote);
      if (quote.status !== "ENVIADO") throw new ConflictError("Só é possível aprovar um orçamento emitido.");
      if (dateOnlyToISO(quote.validUntil) < todayISO()) {
        throw new ConflictError("O orçamento expirou. Edite-o, confirme a disponibilidade e emita uma nova versão.");
      }
      const rental = await reserveInTx(tx, user.id, {
        clientId: quote.clientId,
        eventId: quote.eventId,
        quoteId: id,
        deliveryDate: dateOnlyToISO(quote.deliveryDate),
        startDate: dateOnlyToISO(quote.startDate),
        endDate: dateOnlyToISO(quote.endDate),
        returnDate: dateOnlyToISO(quote.returnDate),
        notes: quote.notes,
        lines: quote.items.map((i) => ({ articleId: i.articleId, quantity: i.quantity })),
      });
      await tx.quote.update({
        where: { id },
        data: { status: "APROVADO", approvedAt: new Date(), approvedById: user.id, approvedVia: "INTERNO", lockVersion: { increment: 1 } },
      });
      await logAudit(
        { actorId: user.id, action: "quote.approve", entity: "Quote", entityId: id, after: { rental: rental.number } },
        tx,
      );
      return rental;
    },
    { timeout: 20_000 },
  );
}

async function changeStatus(
  user: CurrentUser,
  id: string,
  allowed: QuoteStatus[],
  next: QuoteStatus,
  action: string,
  data: Prisma.QuoteUpdateInput = {},
) {
  await prisma.$transaction(async (tx) => {
    const quote = await lockQuote(tx, id);
    assertCanEdit(user, quote);
    if (!allowed.includes(quote.status as QuoteStatus)) {
      throw new ConflictError("Esta operação não é possível no estado atual do orçamento.");
    }
    await tx.quote.update({ where: { id }, data: { ...data, status: next, lockVersion: { increment: 1 } } });
    await logAudit(
      { actorId: user.id, action, entity: "Quote", entityId: id, before: { status: quote.status }, after: { status: next } },
      tx,
    );
  });
}

export function rejectQuote(user: CurrentUser, id: string, reason: string | null) {
  assertPermission(user, "quote:view");
  return changeStatus(user, id, ["ENVIADO", "EXPIRADO"], "REJEITADO", "quote.reject", {
    rejectedAt: new Date(),
    rejectedReason: reason,
  });
}

export function cancelQuote(user: CurrentUser, id: string) {
  assertPermission(user, "quote:cancel");
  return changeStatus(user, id, ["RASCUNHO", "AGUARDANDO_APROVACAO", "ENVIADO", "EXPIRADO"], "CANCELADO", "quote.cancel", {
    cancelledAt: new Date(),
  });
}

/** Cria um novo rascunho a partir de outro orçamento, com os preços atuais do catálogo. */
export async function duplicateQuote(user: CurrentUser, id: string) {
  const source = await getQuote(user, id);
  const validity = (await getCompanySettings()).quoteValidityDays;
  return createQuote(user, {
    clientId: source.client.id,
    eventName: source.event.name,
    venue: source.event.venue,
    city: source.event.city,
    deliveryDate: dateOnlyToISO(source.deliveryDate),
    startDate: dateOnlyToISO(source.startDate),
    endDate: dateOnlyToISO(source.endDate),
    returnDate: dateOnlyToISO(source.returnDate),
    validUntil: addDaysISO(todayISO(), validity),
    discount: source.discountBp,
    notes: source.notes,
    internalNotes: source.internalNotes,
    terms: source.terms,
    items: source.items
      .filter((i) => i.article.status === "ATIVO" && !i.article.archivedAt)
      .map((i) => ({ articleId: i.articleId, quantity: i.quantity, discountBp: i.discountBp })),
    services: source.services.map((s) => ({
      serviceId: s.serviceId,
      description: s.description,
      quantity: s.quantity,
      price: s.unitPriceCents,
    })),
  });
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/** PDF guardado de uma versão emitida (idêntico ao original: verificado pelo hash). */
export async function getVersionPdf(user: CurrentUser, id: string, versionNumber?: number) {
  assertPermission(user, "quote:view");
  const version = await prisma.quoteVersion.findFirst({
    where: { quoteId: id, ...(versionNumber ? { versionNumber } : {}) },
    orderBy: { versionNumber: "desc" },
    include: { quote: { select: { number: true } } },
  });
  if (!version?.pdfStorageKey) throw new NotFoundError("Esta versão não tem PDF.");
  const pdf = await getObject(version.pdfStorageKey);
  if (!pdf) throw new NotFoundError("O ficheiro PDF não foi encontrado.");
  if (version.pdfSha256 && createHash("sha256").update(pdf).digest("hex") !== version.pdfSha256) {
    throw new ConflictError("O ficheiro PDF desta versão foi alterado e não corresponde ao original.");
  }
  return { pdf, filename: `${version.quote.number}-v${version.versionNumber}.pdf` };
}

/** Pré-visualização do estado atual (marcada como rascunho; não é guardada). */
export async function previewPdf(user: CurrentUser, id: string) {
  assertPermission(user, "quote:view");
  const quote = await prisma.quote.findUnique({ where: { id }, select: { number: true, currentVersion: true } });
  if (!quote) throw new NotFoundError("Orçamento não encontrado.");
  const snapshot = await buildSnapshot(prisma, id, { version: quote.currentVersion + 1, issuedBy: user.name });
  return { pdf: await renderQuotePdf(snapshot, { draft: true }), filename: `${quote.number}-rascunho.pdf` };
}

// ---------------------------------------------------------------------------
// Opções para o construtor
// ---------------------------------------------------------------------------

export async function getBuilderOptions(user: CurrentUser) {
  assertPermission(user, "quote:view");
  const [clients, articles, services, settings] = await Promise.all([
    prisma.client.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.article.findMany({
      where: { archivedAt: null, status: "ATIVO" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        priceCents: true,
        priceUnit: true,
        taxRate: { select: { rateBp: true } },
      },
    }),
    prisma.additionalService.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, defaultPriceCents: true, taxRate: { select: { rateBp: true } } },
    }),
    getCompanySettings(),
  ]);
  const fallbackTax = await defaultTaxRate(prisma);
  return { clients, articles, services, settings, fallbackTaxBp: fallbackTax.rateBp };
}
