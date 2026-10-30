import "server-only";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/server/db";
import { assertPermission, type CurrentUser } from "@/server/auth/session";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { logAudit } from "@/server/services/audit";
import type { Prisma } from "@/generated/prisma/client";
import { ROLE_DEFAULT_PERMISSIONS, isInternalRole, type Permission, type RoleKey } from "@/lib/permissions";
import { checkUserStateChange, overridablePermissions } from "@/lib/user-rules";
import type { CreateUserInput, UpdateUserInput, UserListParams } from "@/lib/validation/users";

export const USER_PAGE_SIZE = 20;

export type OverrideChoice = "default" | "grant" | "revoke";

export async function listUsers(actor: CurrentUser, params: UserListParams) {
  assertPermission(actor, "user:manage");

  const where: Prisma.UserWhereInput = { archivedAt: null };
  if (params.perfil !== "todos") where.role = { key: params.perfil };
  if (params.estado !== "todos") where.active = params.estado === "ativos";
  if (params.q) {
    const contains = { contains: params.q, mode: "insensitive" as const };
    where.OR = [{ name: contains }, { email: contains }];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ active: "desc" }, { name: "asc" }],
      skip: (params.pagina - 1) * USER_PAGE_SIZE,
      take: USER_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        mustChangePassword: true,
        lastLoginAt: true,
        role: { select: { key: true, name: true } },
        client: { select: { id: true, name: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, page: params.pagina, pageSize: USER_PAGE_SIZE };
}

export async function getUser(actor: CurrentUser, id: string) {
  assertPermission(actor, "user:manage");
  const user = await prisma.user.findFirst({
    where: { id, archivedAt: null },
    include: {
      role: { select: { key: true, name: true } },
      client: { select: { id: true, name: true, archivedAt: true } },
      permissionOverrides: { include: { permission: { select: { key: true } } } },
    },
  });
  if (!user) throw new NotFoundError("Utilizador não encontrado.");
  return user;
}

const activeAdminCount = () =>
  prisma.user.count({ where: { role: { key: "ADMIN" }, active: true, archivedAt: null } });

async function assertEmailAvailable(email: string, exceptId?: string) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && existing.id !== exceptId) throw new ConflictError("Já existe um utilizador com este email.");
}

/** Contas do portal só podem ser associadas a clientes ativos. */
async function resolveClientId(role: RoleKey, clientId: string | null): Promise<string | null> {
  if (role !== "CLIENTE") return null;
  const client = clientId
    ? await prisma.client.findUnique({ where: { id: clientId }, select: { archivedAt: true } })
    : null;
  if (!client || client.archivedAt) throw new ConflictError("Escolha um cliente ativo para esta conta do portal.");
  return clientId;
}

/**
 * Cria um utilizador com palavra-passe temporária: no primeiro login é
 * obrigado a definir a sua (decisão da Fase 2).
 */
export async function createUser(actor: CurrentUser, input: CreateUserInput) {
  assertPermission(actor, "user:manage");
  await assertEmailAvailable(input.email);
  const clientId = await resolveClientId(input.role, input.clientId);
  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const role = await tx.role.findUniqueOrThrow({ where: { key: input.role } });
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        roleId: role.id,
        clientId,
        maxDiscountBp: isInternalRole(input.role) ? input.maxDiscountBp : 0,
        emailVerified: true,
        mustChangePassword: true,
      },
    });
    await tx.account.create({
      data: { userId: user.id, accountId: user.id, providerId: "credential", password: passwordHash },
    });
    const { password: _password, ...safe } = input;
    await logAudit({ actorId: actor.id, action: "user.create", entity: "User", entityId: user.id, after: safe }, tx);
    return user;
  });
}

export async function updateUser(actor: CurrentUser, id: string, input: UpdateUserInput) {
  assertPermission(actor, "user:manage");
  const before = await getUser(actor, id);
  const beforeRole = before.role.key as RoleKey;

  const error = checkUserStateChange({
    actorId: actor.id,
    before: { id, role: beforeRole, active: before.active },
    after: { role: input.role, active: before.active },
    activeAdminCount: await activeAdminCount(),
  });
  if (error) throw new ConflictError(error);

  await assertEmailAvailable(input.email, id);
  const clientId = await resolveClientId(input.role, input.clientId);
  const roleChanged = input.role !== beforeRole;

  await prisma.$transaction(async (tx) => {
    const role = await tx.role.findUniqueOrThrow({ where: { key: input.role } });
    await tx.user.update({
      where: { id },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        roleId: role.id,
        clientId,
        maxDiscountBp: isInternalRole(input.role) ? input.maxDiscountBp : 0,
      },
    });
    if (roleChanged) {
      // Permissões individuais deixam de fazer sentido com outro papel;
      // termina as sessões para a mudança de área ter efeito imediato.
      await tx.userPermissionOverride.deleteMany({ where: { userId: id } });
      await tx.session.deleteMany({ where: { userId: id } });
    }
    await logAudit(
      {
        actorId: actor.id,
        action: "user.update",
        entity: "User",
        entityId: id,
        before: {
          name: before.name,
          email: before.email,
          phone: before.phone,
          role: beforeRole,
          clientId: before.clientId,
          maxDiscountBp: before.maxDiscountBp,
        },
        after: { ...input, clientId },
      },
      tx,
    );
  });
}

/** Ativa ou desativa uma conta. Desativar termina de imediato as sessões abertas. */
export async function setUserActive(actor: CurrentUser, id: string, active: boolean) {
  assertPermission(actor, "user:manage");
  const user = await getUser(actor, id);

  const error = checkUserStateChange({
    actorId: actor.id,
    before: { id, role: user.role.key as RoleKey, active: user.active },
    after: { role: user.role.key as RoleKey, active },
    activeAdminCount: await activeAdminCount(),
  });
  if (error) throw new ConflictError(error);
  if (active && user.client?.archivedAt) {
    throw new ConflictError("O cliente desta conta está arquivado. Restaure o cliente primeiro.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { active } });
    if (!active) await tx.session.deleteMany({ where: { userId: id } });
    await logAudit(
      { actorId: actor.id, action: active ? "user.activate" : "user.deactivate", entity: "User", entityId: id },
      tx,
    );
  });
}

/**
 * Define uma nova palavra-passe temporária: o utilizador tem de a alterar no
 * próximo login. As sessões abertas terminam.
 */
export async function resetUserPassword(actor: CurrentUser, id: string, password: string) {
  assertPermission(actor, "user:manage");
  if (actor.id === id) throw new ForbiddenError("Para alterar a sua palavra-passe use \"Alterar palavra-passe\".");
  await getUser(actor, id);
  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({ where: { userId: id, providerId: "credential" } });
    if (account) {
      await tx.account.update({ where: { id: account.id }, data: { password: passwordHash } });
    } else {
      await tx.account.create({
        data: { userId: id, accountId: id, providerId: "credential", password: passwordHash },
      });
    }
    await tx.user.update({ where: { id }, data: { mustChangePassword: true } });
    await tx.session.deleteMany({ where: { userId: id } });
    await logAudit({ actorId: actor.id, action: "user.password_reset", entity: "User", entityId: id }, tx);
  });
}

/**
 * Substitui as permissões individuais de um utilizador interno. Só são
 * guardadas as escolhas que diferem das permissões do papel.
 */
export async function setUserPermissions(
  actor: CurrentUser,
  id: string,
  choices: Partial<Record<Permission, OverrideChoice>>,
) {
  assertPermission(actor, "user:manage");
  if (actor.id === id) throw new ForbiddenError("Não pode alterar as suas próprias permissões.");
  const user = await getUser(actor, id);
  const role = user.role.key as RoleKey;
  const allowed = new Set(overridablePermissions(role));
  const roleDefaults = new Set<Permission>(ROLE_DEFAULT_PERMISSIONS[role]);

  const overrides: { key: Permission; granted: boolean }[] = [];
  for (const [key, choice] of Object.entries(choices) as [Permission, OverrideChoice][]) {
    if (!allowed.has(key)) continue;
    if (choice === "grant" && !roleDefaults.has(key)) overrides.push({ key, granted: true });
    if (choice === "revoke" && roleDefaults.has(key)) overrides.push({ key, granted: false });
  }

  await prisma.$transaction(async (tx) => {
    const permissions = await tx.permission.findMany({
      where: { key: { in: overrides.map((o) => o.key) } },
      select: { id: true, key: true },
    });
    const idByKey = new Map(permissions.map((p) => [p.key, p.id]));
    await tx.userPermissionOverride.deleteMany({ where: { userId: id } });
    await tx.userPermissionOverride.createMany({
      data: overrides.map((o) => ({ userId: id, permissionId: idByKey.get(o.key)!, granted: o.granted })),
    });
    await logAudit(
      {
        actorId: actor.id,
        action: "user.permissions",
        entity: "User",
        entityId: id,
        before: user.permissionOverrides.map((o) => ({ key: o.permission.key, granted: o.granted })),
        after: overrides,
      },
      tx,
    );
  });
}
