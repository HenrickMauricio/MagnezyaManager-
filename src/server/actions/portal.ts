"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { INVALID_FIELDS, toActionError, type ActionResult } from "@/server/errors";
import { respondToQuote } from "@/server/services/portal";
import { checkbox, fieldErrorsOf, formToObject, optionalText } from "@/lib/validation/common";

const approveSchema = z.object({
  version: z.coerce.number().int().min(1),
  acceptTerms: checkbox.refine((v) => v, "Para aprovar, aceite as condições da proposta."),
});
const rejectSchema = z.object({ version: z.coerce.number().int().min(1), reason: optionalText(500) });

function revalidatePortal(id: string) {
  revalidatePath("/portal");
  revalidatePath("/portal/propostas");
  revalidatePath(`/portal/propostas/${id}`);
  revalidatePath("/portal/reservas");
}

export async function approveProposalAction(id: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = approveSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    const result = await respondToQuote(user, id, { decision: "approve", version: parsed.data.version, acceptTerms: parsed.data.acceptTerms });
    revalidatePortal(id);
    return {
      ok: true,
      message:
        result.rental?.status === "CONFLITO_STOCK"
          ? "Proposta aprovada. A nossa equipa vai confirmar a disponibilidade de alguns artigos e entra em contacto consigo."
          : `Proposta aprovada. O material está reservado (${result.rental?.number}).`,
    };
  } catch (err) {
    return toActionError(err);
  }
}

export async function rejectProposalAction(id: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = rejectSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    await respondToQuote(user, id, { decision: "reject", version: parsed.data.version, reason: parsed.data.reason });
    revalidatePortal(id);
    return { ok: true, message: "Resposta registada. Obrigado pelo seu feedback." };
  } catch (err) {
    return toActionError(err);
  }
}
