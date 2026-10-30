"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/auth";
import { prisma } from "@/server/db";
import { CHANGE_PASSWORD_PATH, getCurrentUser } from "@/server/auth/session";
import { logAudit } from "@/server/services/audit";
import { clientIp, isLoginThrottled } from "@/server/services/login-throttle";
import { loginSchema } from "@/lib/validation/auth";
import { changePasswordSchema } from "@/lib/validation/users";
import { fieldErrorsOf, formToObject } from "@/lib/validation/common";
import { homePathFor, isInternalRole, type RoleKey } from "@/lib/permissions";

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string[]; password?: string[] };
  email?: string;
};

const INVALID = "Email ou palavra-passe incorretos.";
const THROTTLED = "Demasiadas tentativas. Aguarde um minuto e tente novamente.";

/** Só aceita caminhos internos relativos, para evitar redirecionamentos abertos. */
function safeNext(next: string | undefined, role: RoleKey): string {
  const home = homePathFor(role);
  if (!next || !next.startsWith("/") || next.startsWith("//")) return home;
  const isPortalPath = next === "/portal" || next.startsWith("/portal/");
  if (isInternalRole(role) && isPortalPath) return home;
  if (role === "CLIENTE" && !isPortalPath) return home;
  return next;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: { email: flat.email, password: flat.password },
      email: String(formData.get("email") ?? ""),
    };
  }
  const { email, password, next } = parsed.data;

  if (await isLoginThrottled(email, await clientIp())) {
    await logAudit({ actorId: null, action: "auth.login_throttled", entity: "User", after: { email } });
    return { error: THROTTLED, email };
  }

  // Conta inexistente, inativa ou arquivada → mesma mensagem genérica.
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      active: true,
      archivedAt: true,
      mustChangePassword: true,
      role: { select: { key: true } },
    },
  });
  if (!user || !user.active || user.archivedAt) {
    await logAudit({ actorId: null, action: "auth.login_failed", entity: "User", after: { email } });
    return { error: INVALID, email };
  }

  try {
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch {
    await logAudit({
      actorId: null,
      action: "auth.login_failed",
      entity: "User",
      entityId: user.id,
      after: { email },
    });
    return { error: INVALID, email };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAudit({ actorId: user.id, action: "auth.login", entity: "User", entityId: user.id });

  if (user.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
  redirect(safeNext(next, user.role.key as RoleKey));
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  await auth.api.signOut({ headers: await headers() });
  if (user) await logAudit({ actorId: user.id, action: "auth.logout", entity: "User", entityId: user.id });
  redirect("/login");
}

export type ChangePasswordState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

/**
 * Alteração da palavra-passe pelo próprio utilizador (obrigatória quando a
 * atual é temporária). Termina as outras sessões abertas.
 */
export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = changePasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const { currentPassword, newPassword } = parsed.data;

  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch {
    return { fieldErrors: { currentPassword: ["Palavra-passe atual incorreta."] } };
  }

  await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
  await logAudit({ actorId: user.id, action: "auth.password_changed", entity: "User", entityId: user.id });

  redirect(homePathFor(user.role));
}
