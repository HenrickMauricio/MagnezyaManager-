import "server-only";
import { prisma } from "@/server/db";
import { assertPermission, type CurrentUser } from "@/server/auth/session";
import { ConflictError, NotFoundError } from "@/server/errors";
import { logAudit } from "@/server/services/audit";
import type { Prisma } from "@/generated/prisma/client";
import type { ClientInput, ClientListParams, ContactInput } from "@/lib/validation/clients";

export const CLIENT_PAGE_SIZE = 20;

/** Lista paginada de clientes com pesquisa por nome, NIF, email ou localidade. */
export async function listClients(user: CurrentUser, params: ClientListParams) {
  assertPermission(user, "client:view");

  const where: Prisma.ClientWhereInput = {
    archivedAt: params.estado === "arquivados" ? { not: null } : null,
  };
  if (params.q) {
    const contains = { contains: params.q, mode: "insensitive" as const };
    where.OR = [{ name: contains }, { nif: contains }, { email: contains }, { city: contains }];
  }

  const orderBy: Prisma.ClientOrderByWithRelationInput[] =
    params.ordem === "recentes"
      ? [{ createdAt: "desc" }]
      : params.ordem === "cidade"
        ? [{ city: { sort: "asc", nulls: "last" } }, { name: "asc" }]
        : [{ name: "asc" }];

  const [items, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy,
      skip: (params.pagina - 1) * CLIENT_PAGE_SIZE,
      take: CLIENT_PAGE_SIZE,
      select: {
        id: true,
        type: true,
        name: true,
        nif: true,
        email: true,
        phone: true,
        city: true,
        archivedAt: true,
        contacts: { where: { isPrimary: true }, take: 1, select: { name: true } },
      },
    }),
    prisma.client.count({ where }),
  ]);

  return { items, total, page: params.pagina, pageSize: CLIENT_PAGE_SIZE };
}

export async function getClient(user: CurrentUser, id: string) {
  assertPermission(user, "client:view");
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      portalUsers: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, active: true, lastLoginAt: true },
      },
      createdBy: { select: { name: true } },
    },
  });
  if (!client) throw new NotFoundError("Cliente não encontrado.");
  return client;
}

/** Clientes ativos para listas de escolha (ex.: associar uma conta do portal). */
export async function listClientOptions(user: CurrentUser) {
  assertPermission(user, "client:view");
  return prisma.client.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, nif: true },
  });
}

async function assertNifAvailable(nif: string, exceptId?: string) {
  const existing = await prisma.client.findUnique({ where: { nif }, select: { id: true, name: true, archivedAt: true } });
  if (existing && existing.id !== exceptId) {
    throw new ConflictError(
      `Já existe um cliente com este NIF: ${existing.name}${existing.archivedAt ? " (arquivado)" : ""}.`,
    );
  }
}

function clientData(input: ClientInput) {
  const { gdprConsent: _consent, ...data } = input;
  return data;
}

export async function createClient(user: CurrentUser, input: ClientInput) {
  assertPermission(user, "client:create");
  await assertNifAvailable(input.nif);

  return prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        ...clientData(input),
        gdprConsentAt: input.gdprConsent ? new Date() : null,
        createdById: user.id,
      },
    });
    await logAudit(
      { actorId: user.id, action: "client.create", entity: "Client", entityId: client.id, after: input },
      tx,
    );
    return client;
  });
}

async function getEditableClient(id: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new NotFoundError("Cliente não encontrado.");
  if (client.archivedAt) throw new ConflictError("O cliente está arquivado. Restaure-o antes de o alterar.");
  return client;
}

export async function updateClient(user: CurrentUser, id: string, input: ClientInput) {
  assertPermission(user, "client:edit");
  const before = await getEditableClient(id);
  await assertNifAvailable(input.nif, id);

  // Mantém a data original do consentimento se continuar assinalado.
  const gdprConsentAt = input.gdprConsent ? (before.gdprConsentAt ?? new Date()) : null;

  await prisma.$transaction(async (tx) => {
    await tx.client.update({ where: { id }, data: { ...clientData(input), gdprConsentAt } });
    await logAudit(
      {
        actorId: user.id,
        action: "client.update",
        entity: "Client",
        entityId: id,
        before: auditSnapshot(before),
        after: input,
      },
      tx,
    );
  });
}

/**
 * Arquiva um cliente (o histórico mantém-se) e desativa as contas do portal
 * associadas, terminando as suas sessões.
 */
export async function archiveClient(user: CurrentUser, id: string) {
  assertPermission(user, "client:delete");
  const client = await getEditableClient(id);

  await prisma.$transaction(async (tx) => {
    await tx.client.update({ where: { id }, data: { archivedAt: new Date() } });
    const portalUsers = await tx.user.findMany({ where: { clientId: id, active: true }, select: { id: true } });
    const ids = portalUsers.map((u) => u.id);
    if (ids.length) {
      await tx.user.updateMany({ where: { id: { in: ids } }, data: { active: false } });
      await tx.session.deleteMany({ where: { userId: { in: ids } } });
    }
    await logAudit(
      {
        actorId: user.id,
        action: "client.archive",
        entity: "Client",
        entityId: id,
        after: { name: client.name, portalUsersDeactivated: ids.length },
      },
      tx,
    );
  });
}

export async function restoreClient(user: CurrentUser, id: string) {
  assertPermission(user, "client:delete");
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new NotFoundError("Cliente não encontrado.");
  if (!client.archivedAt) return;

  await prisma.$transaction(async (tx) => {
    await tx.client.update({ where: { id }, data: { archivedAt: null } });
    await logAudit(
      { actorId: user.id, action: "client.restore", entity: "Client", entityId: id, after: { name: client.name } },
      tx,
    );
  });
}

// ---------------------------------------------------------------------------
// Contactos
// ---------------------------------------------------------------------------

export async function addContact(user: CurrentUser, clientId: string, input: ContactInput) {
  assertPermission(user, "client:edit");
  await getEditableClient(clientId);

  await prisma.$transaction(async (tx) => {
    const count = await tx.clientContact.count({ where: { clientId } });
    const isPrimary = input.isPrimary || count === 0; // o primeiro contacto é o principal
    if (isPrimary) await tx.clientContact.updateMany({ where: { clientId }, data: { isPrimary: false } });
    const contact = await tx.clientContact.create({ data: { ...input, isPrimary, clientId } });
    await logAudit(
      { actorId: user.id, action: "contact.create", entity: "Client", entityId: clientId, after: { ...input, id: contact.id } },
      tx,
    );
  });
}

async function getEditableContact(contactId: string) {
  const contact = await prisma.clientContact.findUnique({ where: { id: contactId } });
  if (!contact) throw new NotFoundError("Contacto não encontrado.");
  await getEditableClient(contact.clientId);
  return contact;
}

export async function updateContact(user: CurrentUser, contactId: string, input: ContactInput) {
  assertPermission(user, "client:edit");
  const before = await getEditableContact(contactId);

  await prisma.$transaction(async (tx) => {
    // Um contacto principal só deixa de o ser quando outro é escolhido.
    const isPrimary = input.isPrimary || before.isPrimary;
    if (input.isPrimary && !before.isPrimary) {
      await tx.clientContact.updateMany({ where: { clientId: before.clientId }, data: { isPrimary: false } });
    }
    await tx.clientContact.update({ where: { id: contactId }, data: { ...input, isPrimary } });
    await logAudit(
      {
        actorId: user.id,
        action: "contact.update",
        entity: "Client",
        entityId: before.clientId,
        before: { name: before.name, email: before.email, phone: before.phone, jobTitle: before.jobTitle },
        after: { ...input, id: contactId },
      },
      tx,
    );
  });
}

export async function deleteContact(user: CurrentUser, contactId: string) {
  assertPermission(user, "client:edit");
  const contact = await getEditableContact(contactId);

  await prisma.$transaction(async (tx) => {
    await tx.clientContact.delete({ where: { id: contactId } });
    // Se era o principal, o contacto mais antigo restante passa a principal.
    if (contact.isPrimary) {
      const next = await tx.clientContact.findFirst({
        where: { clientId: contact.clientId },
        orderBy: { createdAt: "asc" },
      });
      if (next) await tx.clientContact.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    await logAudit(
      {
        actorId: user.id,
        action: "contact.delete",
        entity: "Client",
        entityId: contact.clientId,
        before: { name: contact.name, email: contact.email, phone: contact.phone },
      },
      tx,
    );
  });
}

function auditSnapshot(client: Awaited<ReturnType<typeof getEditableClient>>) {
  return {
    type: client.type,
    name: client.name,
    nif: client.nif,
    email: client.email,
    phone: client.phone,
    billingAddress: client.billingAddress,
    postalCode: client.postalCode,
    city: client.city,
    country: client.country,
    notes: client.notes,
    gdprConsentAt: client.gdprConsentAt?.toISOString() ?? null,
  };
}
