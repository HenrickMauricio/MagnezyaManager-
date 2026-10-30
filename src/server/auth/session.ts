import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/auth";
import { prisma } from "@/server/db";
import { ForbiddenError, UnauthenticatedError } from "@/server/errors";
import {
  homePathFor,
  isInternalRole,
  resolvePermissions,
  type Permission,
  type RoleKey,
} from "@/lib/permissions";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: RoleKey;
  roleName: string;
  clientId: string | null;
  maxDiscountBp: number;
  /** Palavra-passe temporária: só pode aceder à página de alteração. */
  mustChangePassword: boolean;
  permissions: ReadonlySet<Permission>;
};

export const CHANGE_PASSWORD_PATH = "/alterar-palavra-passe";

/**
 * Utilizador da sessão atual, com papel e permissões efetivas lidos da BD
 * em cada pedido (memorizado por pedido via React `cache`).
 * Devolve null se não houver sessão válida ou se a conta estiver inativa.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      permissionOverrides: { include: { permission: true } },
    },
  });
  if (!user || !user.active || user.archivedAt) return null;

  const permissions = resolvePermissions(
    user.role.permissions.map((rp) => rp.permission.key),
    user.permissionOverrides.map((o) => ({ key: o.permission.key, granted: o.granted })),
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.key as RoleKey,
    roleName: user.role.name,
    clientId: user.clientId,
    maxDiscountBp: user.maxDiscountBp,
    mustChangePassword: user.mustChangePassword,
    permissions,
  };
});

// ---------------------------------------------------------------------------
// Guardas para páginas (redirecionam) — usar em layouts e páginas.
// ---------------------------------------------------------------------------

/** Utilizador com sessão, sem verificar a palavra-passe temporária (só para a página de alteração). */
export async function requireSessionPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePageUser(): Promise<CurrentUser> {
  const user = await requireSessionPage();
  if (user.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
  return user;
}

export async function requireInternalPage(): Promise<CurrentUser> {
  const user = await requirePageUser();
  if (!isInternalRole(user.role)) redirect(homePathFor(user.role));
  return user;
}

export async function requireClientPage(): Promise<CurrentUser & { clientId: string }> {
  const user = await requirePageUser();
  if (user.role !== "CLIENTE" || !user.clientId) redirect(homePathFor(user.role));
  return user as CurrentUser & { clientId: string };
}

export async function requirePagePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requirePageUser();
  if (!user.permissions.has(permission)) redirect("/sem-acesso");
  return user;
}

// ---------------------------------------------------------------------------
// Guardas para Server Actions e serviços (lançam erros) — nunca confiar na UI.
// ---------------------------------------------------------------------------

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  if (user.mustChangePassword) throw new ForbiddenError("Altere a palavra-passe temporária antes de continuar.");
  return user;
}

export async function requirePermission(...required: Permission[]): Promise<CurrentUser> {
  const user = await requireUser();
  assertPermission(user, ...required);
  return user;
}

export function assertPermission(user: CurrentUser, ...required: Permission[]): void {
  for (const p of required) {
    if (!user.permissions.has(p)) throw new ForbiddenError();
  }
}
