"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { INVALID_FIELDS, toActionError, type ActionResult } from "@/server/errors";
import * as inventory from "@/server/services/inventory";
import { fieldErrorsOf, formToObject } from "@/lib/validation/common";
import { completeMaintenanceSchema, maintenanceSchema, movementSchema } from "@/lib/validation/catalog";

function revalidateArticle(articleId: string) {
  revalidatePath(`/artigos/${articleId}`);
  revalidatePath("/artigos");
  revalidatePath("/inventario");
}

export async function createMovementAction(articleId: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = movementSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    await inventory.createMovement(user, articleId, parsed.data);
    revalidateArticle(articleId);
    return { ok: true, message: "Movimento registado." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function createMaintenanceAction(articleId: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = maintenanceSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    await inventory.createMaintenance(user, articleId, parsed.data);
    revalidateArticle(articleId);
    return { ok: true, message: "Manutenção registada." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function startMaintenanceAction(articleId: string, id: string): Promise<ActionResult> {
  try {
    await inventory.startMaintenance(await requireUser(), id);
    revalidateArticle(articleId);
    return { ok: true, message: "Manutenção marcada como em reparação." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function completeMaintenanceAction(
  articleId: string,
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = completeMaintenanceSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    await inventory.completeMaintenance(user, id, parsed.data);
    revalidateArticle(articleId);
    return { ok: true, message: "Manutenção concluída." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function cancelMaintenanceAction(articleId: string, id: string): Promise<ActionResult> {
  try {
    await inventory.cancelMaintenance(await requireUser(), id);
    revalidateArticle(articleId);
    return { ok: true, message: "Registo de manutenção anulado." };
  } catch (err) {
    return toActionError(err);
  }
}
