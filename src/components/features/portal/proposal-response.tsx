"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { approveProposalAction, rejectProposalAction } from "@/server/actions/portal";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, FieldError, Textarea } from "@/components/ui/field";
import { formatCents, formatISODate } from "@/lib/format";

/** Aprovar ou recusar a proposta (versão indicada), com aceitação das condições. */
export function ProposalResponse({
  id,
  version,
  totalCents,
  validUntil,
}: {
  id: string;
  version: number;
  totalCents: number;
  validUntil: string;
}) {
  const [rejecting, setRejecting] = useState(false);

  return (
    <Card className="border-fg/20 p-5">
      <h2 className="font-display text-[18px] font-semibold tracking-tight">A sua resposta</h2>
      <p className="mt-1 text-[14px] text-fg-muted">
        Proposta válida até {formatISODate(validUntil)}. Ao aprovar, o material fica reservado para o seu evento.
      </p>
      <ActionForm action={approveProposalAction.bind(null, id)} className="mt-5 space-y-4">
        {({ errors: e, pending }) => (
          <>
            <input type="hidden" name="version" value={version} />
            <Checkbox
              name="acceptTerms"
              label={`Aceito a proposta (versão ${version}) e as condições indicadas`}
              description={`Total com IVA: ${formatCents(totalCents)}`}
            />
            <FieldError messages={e.acceptTerms} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" size="lg" loading={pending} className="sm:flex-1">
                <CheckCircle2 className="size-5" /> Aprovar proposta
              </Button>
              <Button type="button" size="lg" variant="secondary" onClick={() => setRejecting(true)}>
                <XCircle className="size-5" /> Recusar
              </Button>
            </div>
          </>
        )}
      </ActionForm>

      <Dialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Recusar proposta?"
        description="Pode indicar o motivo; ajuda-nos a preparar uma alternativa."
      >
        {rejecting && (
          <ActionForm action={rejectProposalAction.bind(null, id)} onSuccess={() => setRejecting(false)} className="space-y-5">
            {({ errors: e, pending }) => (
              <>
                <input type="hidden" name="version" value={version} />
                <Field label="Motivo (opcional)" htmlFor="reject-reason" errors={e.reason}>
                  <Textarea id="reject-reason" name="reason" rows={3} placeholder="Ex.: preferimos outras datas" />
                </Field>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={() => setRejecting(false)}>
                    Voltar
                  </Button>
                  <Button type="submit" variant="danger" loading={pending}>
                    Recusar proposta
                  </Button>
                </div>
              </>
            )}
          </ActionForm>
        )}
      </Dialog>
    </Card>
  );
}
