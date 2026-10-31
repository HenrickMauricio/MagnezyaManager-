"use client";

import Link from "next/link";
import { useState } from "react";
import { Ban, CheckCircle2, Copy, Download, Eye, FileCheck2, Pencil, ShieldCheck, XCircle } from "lucide-react";
import {
  approveDiscountAction,
  approveQuoteAction,
  cancelQuoteAction,
  duplicateQuoteAction,
  issueQuoteAction,
  rejectQuoteAction,
} from "@/server/actions/quotes";
import { ActionButton } from "@/components/action-button";
import { ActionForm } from "@/components/action-form";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmButton, Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import type { QuoteStatus } from "@/lib/validation/quotes";

export function QuoteActions({
  id,
  number,
  status,
  nextVersion,
  hasVersions,
  canEdit,
  canIssue,
  canApproveDiscount,
  canCancel,
  canCreate,
  rentalId,
}: {
  id: string;
  number: string;
  status: QuoteStatus;
  nextVersion: number;
  hasVersions: boolean;
  canEdit: boolean;
  canIssue: boolean;
  canApproveDiscount: boolean;
  canCancel: boolean;
  canCreate: boolean;
  rentalId: string | null;
}) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const editable = canEdit && ["RASCUNHO", "AGUARDANDO_APROVACAO", "ENVIADO", "EXPIRADO"].includes(status);

  return (
    <>
      {hasVersions && (
        <a href={`/api/orcamentos/${id}/pdf`} className={buttonClasses({ variant: status === "ENVIADO" ? "primary" : "secondary" })}>
          <Download className="size-4" /> Descarregar PDF
        </a>
      )}
      {(status === "RASCUNHO" || status === "AGUARDANDO_APROVACAO") && (
        <a href={`/api/orcamentos/${id}/pre-visualizacao`} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "secondary" })}>
          <Eye className="size-4" /> Pré-visualizar
        </a>
      )}
      {editable && (
        <Link href={`/orcamentos/${id}/editar`} className={buttonClasses({ variant: "secondary" })}>
          <Pencil className="size-4" /> Editar
        </Link>
      )}
      {status === "RASCUNHO" && canEdit && canIssue && (
        <ConfirmButton
          tone="primary"
          title={`Emitir ${number} — versão ${nextVersion}?`}
          description="A proposta fica congelada nesta versão e o PDF é gerado. Alterações posteriores criam uma nova versão; esta nunca muda."
          confirmLabel="Emitir"
          action={issueQuoteAction.bind(null, id)}
        >
          <FileCheck2 className="size-4" /> Emitir
        </ConfirmButton>
      )}
      {status === "AGUARDANDO_APROVACAO" && canApproveDiscount && (
        <ConfirmButton
          tone="primary"
          title="Aprovar desconto e emitir?"
          description="O desconto deste orçamento excede o limite de quem o preparou. Ao aprovar, a proposta é emitida de imediato."
          confirmLabel="Aprovar e emitir"
          action={approveDiscountAction.bind(null, id)}
        >
          <ShieldCheck className="size-4" /> Aprovar desconto
        </ConfirmButton>
      )}
      {status === "ENVIADO" && canEdit && (
        <ConfirmButton
          tone="primary"
          variant="secondary"
          title="Registar aprovação do cliente?"
          description="O stock é reservado de imediato. Se entretanto faltar algum artigo, a aprovação é recusada e indicamos o que falta."
          confirmLabel="Aprovar e reservar"
          action={approveQuoteAction.bind(null, id)}
        >
          <CheckCircle2 className="size-4" /> Aprovado pelo cliente
        </ConfirmButton>
      )}
      {(status === "ENVIADO" || status === "EXPIRADO") && canEdit && (
        <Button variant="secondary" onClick={() => setRejecting(true)}>
          <XCircle className="size-4" /> Rejeitado
        </Button>
      )}
      {rentalId && (
        <Link href={`/reservas/${rentalId}`} className={buttonClasses({ variant: "secondary" })}>
          Ver reserva
        </Link>
      )}
      {canCreate && (
        <ActionButton
          variant="ghost"
          action={async () => {
            const result = await duplicateQuoteAction(id);
            if (result.ok && result.redirectTo) {
              toast.success(result.message ?? "Cópia criada.");
              router.push(result.redirectTo);
              return { ok: true };
            }
            return result;
          }}
        >
          <Copy className="size-4" /> Duplicar
        </ActionButton>
      )}
      {canCancel && canEdit && ["RASCUNHO", "AGUARDANDO_APROVACAO", "ENVIADO", "EXPIRADO"].includes(status) && (
        <ConfirmButton
          variant="ghost"
          title={`Cancelar ${number}?`}
          description="O orçamento deixa de poder ser emitido ou aprovado. As versões emitidas ficam no histórico."
          confirmLabel="Cancelar orçamento"
          action={cancelQuoteAction.bind(null, id)}
        >
          <Ban className="size-4" /> Cancelar
        </ConfirmButton>
      )}

      <Dialog open={rejecting} onClose={() => setRejecting(false)} title="Orçamento rejeitado pelo cliente" description="Fica registado no histórico; pode duplicá-lo mais tarde.">
        {rejecting && (
          <ActionForm action={rejectQuoteAction.bind(null, id)} onSuccess={() => setRejecting(false)} className="space-y-5">
            {({ errors: e, pending }) => (
              <>
                <Field label="Motivo (opcional)" htmlFor="reject-reason" errors={e.reason}>
                  <Input id="reject-reason" name="reason" placeholder="Ex.: preço acima do orçamento do cliente" autoFocus />
                </Field>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={() => setRejecting(false)}>
                    Voltar
                  </Button>
                  <Button type="submit" variant="danger" loading={pending}>
                    Marcar como rejeitado
                  </Button>
                </div>
              </>
            )}
          </ActionForm>
        )}
      </Dialog>
    </>
  );
}
