"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { INVALID_FIELDS, toActionError, type ActionResult } from "@/server/errors";
import * as quotes from "@/server/services/quotes";
import { formatBasisPoints } from "@/lib/format";
import { fieldErrorsOf, formToObject } from "@/lib/validation/common";
import { quoteSchema, rejectSchema } from "@/lib/validation/quotes";

function revalidateQuotes(id?: string) {
  revalidatePath("/orcamentos");
  if (id) revalidatePath(`/orcamentos/${id}`);
  revalidatePath("/painel");
}

export async function saveQuoteAction(id: string | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = quoteSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    if (id) {
      await quotes.updateQuote(user, id, parsed.data);
      revalidateQuotes(id);
      return { ok: true, message: "Orçamento guardado.", redirectTo: `/orcamentos/${id}` };
    }
    const quote = await quotes.createQuote(user, parsed.data);
    revalidateQuotes();
    return { ok: true, message: `Orçamento ${quote.number} criado.`, redirectTo: `/orcamentos/${quote.id}` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function issueQuoteAction(id: string): Promise<ActionResult> {
  try {
    const result = await quotes.issueQuote(await requireUser(), id);
    revalidateQuotes(id);
    return {
      ok: true,
      message:
        result.status === "ENVIADO"
          ? `Versão ${result.version} emitida. O PDF está pronto a descarregar.`
          : `Desconto de ${formatBasisPoints(result.discountBp)} acima do seu limite: enviado para aprovação de um administrador.`,
    };
  } catch (err) {
    return toActionError(err);
  }
}

export async function approveDiscountAction(id: string): Promise<ActionResult> {
  try {
    const result = await quotes.approveDiscountAndIssue(await requireUser(), id);
    revalidateQuotes(id);
    return { ok: true, message: result.status === "ENVIADO" ? `Desconto aprovado e versão ${result.version} emitida.` : "Desconto aprovado." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function approveQuoteAction(id: string): Promise<ActionResult> {
  try {
    const rental = await quotes.approveQuote(await requireUser(), id);
    revalidateQuotes(id);
    revalidatePath("/reservas");
    revalidatePath("/calendario");
    return { ok: true, message: `Orçamento aprovado. Reserva ${rental.number} criada.` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function rejectQuoteAction(id: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = rejectSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    await quotes.rejectQuote(user, id, parsed.data.reason);
    revalidateQuotes(id);
    return { ok: true, message: "Orçamento marcado como rejeitado." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function cancelQuoteAction(id: string): Promise<ActionResult> {
  try {
    await quotes.cancelQuote(await requireUser(), id);
    revalidateQuotes(id);
    return { ok: true, message: "Orçamento cancelado." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function duplicateQuoteAction(id: string): Promise<ActionResult> {
  try {
    const copy = await quotes.duplicateQuote(await requireUser(), id);
    revalidateQuotes();
    return { ok: true, message: `Cópia criada: ${copy.number}.`, redirectTo: `/orcamentos/${copy.id}/editar` };
  } catch (err) {
    return toActionError(err);
  }
}
