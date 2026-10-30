"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { INVALID_FIELDS, toActionError, type ActionResult } from "@/server/errors";
import * as users from "@/server/services/users";
import { isPermission, type Permission } from "@/lib/permissions";
import { createUserSchema, resetPasswordSchema, updateUserSchema } from "@/lib/validation/users";
import { fieldErrorsOf, formToObject } from "@/lib/validation/common";

export async function createUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireUser();
    const parsed = createUserSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    const user = await users.createUser(actor, parsed.data);
    revalidatePath("/utilizadores");
    return {
      ok: true,
      message: "Utilizador criado. Comunique-lhe a palavra-passe temporária.",
      redirectTo: `/utilizadores/${user.id}`,
    };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateUserAction(id: string, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireUser();
    const parsed = updateUserSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    await users.updateUser(actor, id, parsed.data);
    revalidatePath("/utilizadores");
    return { ok: true, message: "Alterações guardadas." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setUserActiveAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    await users.setUserActive(await requireUser(), id, active);
    revalidatePath("/utilizadores");
    return { ok: true, message: active ? "Conta ativada." : "Conta desativada e sessões terminadas." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function resetUserPasswordAction(id: string, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireUser();
    const parsed = resetPasswordSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    await users.resetUserPassword(actor, id, parsed.data.password);
    revalidatePath(`/utilizadores/${id}`);
    return { ok: true, message: "Palavra-passe temporária definida. Terá de ser alterada no próximo login." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setUserPermissionsAction(id: string, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireUser();
    const choices: Partial<Record<Permission, users.OverrideChoice>> = {};
    for (const [key, value] of Object.entries(formToObject(formData))) {
      const perm = key.replace(/^perm:/, "");
      if (key.startsWith("perm:") && isPermission(perm) && (value === "grant" || value === "revoke")) {
        choices[perm] = value;
      }
    }
    await users.setUserPermissions(actor, id, choices);
    revalidatePath(`/utilizadores/${id}`);
    return { ok: true, message: "Permissões atualizadas." };
  } catch (err) {
    return toActionError(err);
  }
}
