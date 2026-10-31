"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { INVALID_FIELDS, toActionError, type ActionResult } from "@/server/errors";
import { MAX_IMAGE_BYTES } from "@/server/services/images";
import * as settings from "@/server/services/settings";
import { fieldErrorsOf, formToObject } from "@/lib/validation/common";
import { companySettingsSchema, serviceSchema } from "@/lib/validation/settings";

export async function updateCompanySettingsAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = companySettingsSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    await settings.updateCompanySettings(user, parsed.data);
    revalidatePath("/definicoes");
    return { ok: true, message: "Definições guardadas." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function uploadLogoAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolha uma imagem." };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "A imagem excede 8 MB." };
    await settings.setLogo(user, Buffer.from(await file.arrayBuffer()));
    revalidatePath("/definicoes");
    return { ok: true, message: "Logótipo atualizado." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function removeLogoAction(): Promise<ActionResult> {
  try {
    await settings.removeLogo(await requireUser());
    revalidatePath("/definicoes");
    return { ok: true, message: "Logótipo removido." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function saveServiceAction(id: string | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = serviceSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    await settings.saveService(user, id, parsed.data);
    revalidatePath("/definicoes");
    return { ok: true, message: id ? "Serviço atualizado." : "Serviço criado." };
  } catch (err) {
    return toActionError(err);
  }
}
