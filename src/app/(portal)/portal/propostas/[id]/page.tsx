import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Download, Info } from "lucide-react";
import { requireClientPage } from "@/server/auth/session";
import { getPortalQuote } from "@/server/services/portal";
import { orNotFound } from "@/server/page-helpers";
import { PortalStateBadge, PORTAL_RENTAL_LABELS } from "@/components/features/portal/portal-state";
import { ProposalResponse } from "@/components/features/portal/proposal-response";
import { ProposalView } from "@/components/features/portal/proposal-view";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { dateOnlyToISO, formatCents, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Proposta" };

export default async function PortalProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireClientPage();
  const q = await orNotFound(getPortalQuote(user, id));
  const latest = q.versions[0]!;
  const canRespond = q.state === "PENDENTE" && user.permissions.has("portal:quote_respond");
  const hasAside = canRespond || q.versions.length > 1;
  const pdfHref = (v: number, inline = false) => `/api/portal/propostas/${q.id}/pdf?versao=${v}${inline ? "&ver=1" : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/portal/propostas", label: "Propostas" }}
        eyebrow={<PortalStateBadge state={q.state} />}
        title={`Proposta ${q.number}`}
        description={`Versão ${latest.versionNumber} · emitida a ${formatDateTime(latest.issuedAt)}`}
        actions={
          <a href={pdfHref(latest.versionNumber)} className={buttonClasses({ variant: "secondary" })}>
            <Download className="size-4" /> Descarregar PDF
          </a>
        }
      />

      {q.state === "APROVADA" && (
        <div role="status" className="flex gap-3 rounded-md bg-success-bg px-4 py-3 text-[14px] text-success">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div>
            Aprovada{q.approvedBy && ` por ${q.approvedBy.name}`}
            {q.approvedAt && ` a ${formatDateTime(q.approvedAt)}`}
            {q.approvedVersion && ` (versão ${q.approvedVersion})`}.
            {q.rental && (
              <span className="block text-fg">
                Reserva {q.rental.number}: {PORTAL_RENTAL_LABELS[q.rental.status] ?? q.rental.status}.{" "}
                <Link href="/portal/reservas" className="underline underline-offset-2">
                  Ver reservas
                </Link>
              </span>
            )}
          </div>
        </div>
      )}
      {q.state === "RECUSADA" && (
        <div className="rounded-md bg-surface-2 px-4 py-3 text-[14px] text-fg-muted">
          Recusada{q.rejectedBy && ` por ${q.rejectedBy.name}`}
          {q.rejectedAt && ` a ${formatDateTime(q.rejectedAt)}`}
          {q.rejectedReason && ` — "${q.rejectedReason}"`}.
        </div>
      )}
      {(q.state === "EXPIRADA" || q.state === "EM_REVISAO" || q.state === "CANCELADA") && (
        <div className="flex gap-3 rounded-md bg-warning-bg px-4 py-3 text-[14px] text-warning">
          <Info className="mt-0.5 size-5 shrink-0" />
          {q.state === "EXPIRADA" && "Esta proposta expirou. Contacte-nos para receber uma proposta atualizada."}
          {q.state === "EM_REVISAO" && "Estamos a rever esta proposta. Receberá uma nova versão em breve."}
          {q.state === "CANCELADA" && "Esta proposta foi cancelada."}
        </div>
      )}

      <div className={`grid grid-cols-[minmax(0,1fr)] gap-6 ${hasAside ? "lg:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
        <ProposalView q={q.snapshot} />
        {hasAside && (
          <div className="space-y-6">
            {canRespond && (
              <ProposalResponse id={q.id} version={latest.versionNumber} totalCents={latest.totalCents} validUntil={dateOnlyToISO(q.validUntil)} />
            )}
            {q.versions.length > 1 && (
              <Card>
                <CardHeader title="Versões recebidas" />
                <ul className="divide-y divide-border">
                  {q.versions.map((v) => (
                    <li key={v.versionNumber} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px]">
                      <span>
                        <span className="font-medium">Versão {v.versionNumber}</span>
                        <span className="text-fg-muted"> · {formatCents(v.totalCents)}</span>
                      </span>
                      <a href={pdfHref(v.versionNumber)} className="text-[13px] font-medium text-fg-muted hover:text-fg">
                        PDF
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
