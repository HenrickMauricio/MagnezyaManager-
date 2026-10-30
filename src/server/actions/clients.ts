"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { INVALID_FIELDS, toActionError, type ActionResult } from "@/server/errors";
import * as clients from "@/server/services/clients";
import { clientSchema, contactSchema } from "@/lib/validation/clients";
import { fieldErrorsOf, formToObject } from "@/lib/validation/common";

export async function createClientAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = clientSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    const client = await clients.createClient(user, parsed.data);
    revalidatePath("/clientes");
    return { ok: true, message: "Cliente criado.", redirectTo: `/clientes/${client.id}` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateClientAction(id: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = clientSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    await clients.updateClient(user, id, parsed.data);
    revalidatePath("/clientes");
    return { ok: true, message: "Alterações guardadas.", redirectTo: `/clientes/${id}` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function archiveClientAction(id: string): Promise<ActionResult> {
  try {
    await clients.archiveClient(await requireUser(), id);
    revalidatePath("/clientes");
    return { ok: true, message: "Cliente arquivado." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function restoreClientAction(id: string): Promise<ActionResult> {
  try {
    await clients.restoreClient(await requireUser(), id);
    revalidatePath("/clientes");
    return { ok: true, message: "Cliente restaurado." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function saveContactAction(
  clientId: string,
  contactId: string | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = contactSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    if (contactId) await clients.updateContact(user, contactId, parsed.data);
    else await clients.addContact(user, clientId, parsed.data);
    revalidatePath(`/clientes/${clientId}`);
    return { ok: true, message: contactId ? "Contacto atualizado." : "Contacto adicionado." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteContactAction(clientId: string, contactId: string): Promise<ActionResult> {
  try {
    await clients.deleteContact(await requireUser(), contactId);
    revalidatePath(`/clientes/${clientId}`);
    return { ok: true, message: "Contacto eliminado." };
  } catch (err) {
    return toActionError(err);
  }
}
