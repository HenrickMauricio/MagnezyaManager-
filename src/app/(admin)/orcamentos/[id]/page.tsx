import type { Metadata } from "next";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { lineAvailability } from "@/server/services/availability";
import { getQuote } from "@/server/services/quotes";
import { orNotFound } from "@/server/page-helpers";
import { QuoteActions } from "@/components/features/quotes/quote-actions";
import { QuoteStatusBadge } from "@/components/features/quotes/quote-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DetailList, PageHeader } from "@/components/ui/page";
import { Table, Td, Th } from "@/components/ui/table";
import { canEditQuote } from "@/lib/permissions";
import { fileUrl } from "@/lib/files";
import { dateOnlyToISO, formatBasisPoints, formatCents, formatDateTime, formatInteger, formatISODate } from "@/lib/format";
import { billableDaysBetween, computeTotals } from "@/lib/pricing";
import { OPEN_STATUSES, type QuoteStatus } from "@/lib/validation/quotes";

export const metadata: Metadata = { title: "Orçamento" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("quote:view");
  const q = await orNotFound(getQuote(user, id));
  const status = q.status as QuoteStatus;
  const iso = (d: Date) => formatISODate(dateOnlyToISO(d));
  const totals = computeTotals(q.items, q.services, q.discountBp);
  const days = billableDaysBetween(dateOnlyToISO(q.startDate), dateOnlyToISO(q.endDate));

  // Disponibilidade atual de cada linha (só enquanto o orçamento está em aberto).
  const showAvailability = OPEN_STATUSES.includes(status) && user.permissions.has("availability:view");
  const availability = showAvailability
    ? new Map(
        (await lineAvailability(prisma, q.items.map((i) => i.articleId), dateOnlyToISO(q.deliveryDate), dateOnlyToISO(q.returnDate))).map(
          (a) => [a.articleId, a],
        ),
      )
    : null;
  const shortages = q.items.filter((i) => (availability?.get(i.articleId)?.minAvailable ?? Infinity) < i.quantity);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        back={{ href: "/orcamentos", label: "Orçamentos" }}
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2">
            <QuoteStatusBadge status={status} />
            {q.currentVersion > 0 && <Badge>v{q.currentVersion}</Badge>}
            <span>por {q.createdBy.name}</span>
          </span>
        }
        title={`${q.number} · ${q.event.name}`}
        description={
          user.permissions.has("client:view") ? (
            <Link href={`/clientes/${q.client.id}`} className="underline underline-offset-2 hover:text-fg">
              {q.client.name}
            </Link>
          ) : (
            q.client.name
          )
        }
        actions={
          <QuoteActions
            id={q.id}
            number={q.number}
            status={status}
            nextVersion={q.currentVersion + 1}
            hasVersions={q.versions.length > 0}
            canEdit={canEditQuote(user, q)}
            canIssue={user.permissions.has("quote:send")}
            canApproveDiscount={user.permissions.has("quote:approve_internal")}
            canCancel={user.permissions.has("quote:cancel")}
            canCreate={user.permissions.has("quote:create")}
            rentalId={q.rental?.id ?? null}
          />
        }
      />

      {status === "AGUARDANDO_APROVACAO" && (
        <div role="status" className="rounded-md bg-warning-bg px-4 py-3 text-[14px] text-warning">
          Desconto efetivo de {formatBasisPoints(totals.effectiveDiscountBp)} acima do limite de quem emitiu. Aguarda aprovação de um administrador.
        </div>
      )}
      {shortages.length > 0 && (
        <div role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-[14px] text-danger">
          Sem stock suficiente para {shortages.map((s) => `"${s.nameSnapshot}"`).join(", ")} nestas datas. A aprovação será recusada enquanto faltar material.
        </div>
      )}
      {q.approvedVia === "PORTAL" && q.approvedAt && (
        <div role="status" className="rounded-md bg-success-bg px-4 py-3 text-[14px] text-success">
          Aprovado pelo cliente no portal{q.approvedBy && ` por ${q.approvedBy.name}`} a {formatDateTime(q.approvedAt)}
          {q.approvedVersion && ` (versão ${q.approvedVersion})`}
          {q.approvalIp && ` · IP ${q.approvalIp}`}.
          {q.rental?.status === "CONFLITO_STOCK" && " A reserva ficou em conflito de stock: resolva-a na ficha da reserva."}
        </div>
      )}
      {q.status === "REJEITADO" && (
        <div className="rounded-md bg-surface-2 px-4 py-3 text-[14px] text-fg-muted">
          {q.rejectedVia === "PORTAL" ? "Recusado pelo cliente no portal" : "Rejeitado"}
          {q.rejectedBy && ` por ${q.rejectedBy.name}`}
          {q.rejectedAt && ` a ${formatDateTime(q.rejectedAt)}`}
          {q.rejectionIp && ` · IP ${q.rejectionIp}`}
          {q.rejectedReason && ` — motivo: ${q.rejectedReason}`}
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader title="Artigos" description={`${days} ${days === 1 ? "dia" : "dias"} de evento · preços sem IVA`} />
        <Table className="min-w-[760px]">
          <thead>
            <tr>
              <Th>Artigo</Th>
              <Th className="text-right">Qtd.</Th>
              <Th className="text-right">Preço un.</Th>
              <Th className="text-right">Desc.</Th>
              <Th className="text-right">IVA</Th>
              {availability && <Th>Disponível</Th>}
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((item, i) => {
              const image = item.article.images[0];
              const avail = availability?.get(item.articleId);
              return (
                <tr key={item.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-surface-2">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={fileUrl(image.storageKey, "thumb")} alt="" className="size-full object-cover" />
                        ) : (
                          <ImageIcon className="absolute inset-0 m-auto size-4 text-fg-subtle" strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium">{item.nameSnapshot}</div>
                        <div className="tabular text-[12px] text-fg-subtle">{item.skuSnapshot}</div>
                      </div>
                    </div>
                  </Td>
                  <Td className="tabular text-right">
                    {formatInteger(item.quantity)} <span className="text-fg-subtle">{item.article.unit}</span>
                  </Td>
                  <Td className="tabular whitespace-nowrap text-right">
                    {formatCents(item.unitPriceCents)}
                    <div className="text-[12px] text-fg-subtle">{item.priceUnit === "POR_DIA" ? "por dia" : "por evento"}</div>
                  </Td>
                  <Td className="tabular text-right text-fg-muted">{item.discountBp ? formatBasisPoints(item.discountBp) : "—"}</Td>
                  <Td className="tabular text-right text-fg-muted">{formatBasisPoints(item.taxRateBp)}</Td>
                  {availability && (
                    <Td>
                      {avail && (
                        <span className={avail.minAvailable >= item.quantity ? "text-success" : "font-medium text-danger"}>
                          {formatInteger(Math.max(0, avail.minAvailable))} livres
                        </span>
                      )}
                    </Td>
                  )}
                  <Td className="tabular whitespace-nowrap text-right font-medium">{formatCents(totals.itemTotals[i]!)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {q.services.length > 0 && (
          <ul className="divide-y divide-border border-t border-border">
            {q.services.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3 text-[14px]">
                <span>
                  {s.description}
                  <span className="text-fg-subtle">
                    {" "}
                    · {formatInteger(s.quantity)} × {formatCents(s.unitPriceCents)} · IVA {formatBasisPoints(s.taxRateBp)}
                  </span>
                </span>
                <span className="tabular font-medium">{formatCents(totals.serviceTotals[i]!)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end border-t border-border px-5 py-4">
          <dl className="w-full max-w-sm space-y-1.5 text-[14px]">
            <TotalRow label="Artigos" value={formatCents(totals.subtotalCents)} />
            {totals.discountCents > 0 && <TotalRow label={`Desconto (${formatBasisPoints(q.discountBp)})`} value={`−${formatCents(totals.discountCents)}`} />}
            {totals.servicesCents > 0 && <TotalRow label="Serviços" value={formatCents(totals.servicesCents)} />}
            {totals.taxLines.map((t) => (
              <TotalRow key={t.rateBp} muted label={`IVA ${formatBasisPoints(t.rateBp)} sobre ${formatCents(t.baseCents)}`} value={formatCents(t.taxCents)} />
            ))}
            <div className="flex items-baseline justify-between border-t border-border pt-2 font-display text-[20px] font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{formatCents(totals.totalCents)}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Evento e datas" />
          <DetailList
            items={[
              { label: "Local", value: [q.event.venue, q.event.city].filter(Boolean).join(", ") || null },
              { label: "Válido até", value: iso(q.validUntil) },
              { label: "Entrega / montagem", value: iso(q.deliveryDate) },
              { label: "Recolha", value: iso(q.returnDate) },
              { label: "Evento", value: `${iso(q.startDate)} – ${iso(q.endDate)}`, wide: true },
              { label: "Observações", value: q.notes, wide: true },
              { label: "Notas internas", value: q.internalNotes, wide: true },
            ]}
          />
        </Card>

        <Card>
          <CardHeader title="Versões emitidas" description="Cada versão é imutável: o PDF guarda os valores do momento da emissão." />
          {q.versions.length === 0 ? (
            <p className="px-5 py-8 text-center text-[14px] text-fg-muted">Ainda não foi emitida nenhuma versão.</p>
          ) : (
            <ul className="divide-y divide-border">
              {q.versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[14px]">
                  <div>
                    <span className="font-medium">Versão {v.versionNumber}</span>
                    <span className="text-fg-muted">
                      {" "}
                      · {formatCents(v.totalCents)} · {formatDateTime(v.issuedAt)}
                      {v.issuedBy && ` · ${v.issuedBy.name}`}
                    </span>
                  </div>
                  <div className="flex gap-3 text-[13px] font-medium">
                    <a href={`/api/orcamentos/${q.id}/pdf?versao=${v.versionNumber}&ver=1`} target="_blank" rel="noreferrer" className="text-fg-muted hover:text-fg">
                      Ver
                    </a>
                    <a href={`/api/orcamentos/${q.id}/pdf?versao=${v.versionNumber}`} className="text-fg-muted hover:text-fg">
                      Descarregar
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border px-5 py-3 text-[12px] text-fg-subtle">
            Criado a {formatDateTime(q.createdAt)}
            {q.internalApprovedBy && q.internalApprovedAt && ` · desconto aprovado por ${q.internalApprovedBy.name} a ${formatDateTime(q.internalApprovedAt)}`}
            {q.approvedAt && ` · aprovado a ${formatDateTime(q.approvedAt)}${q.approvedBy ? ` (registado por ${q.approvedBy.name})` : ""}`}
          </div>
        </Card>
      </div>
    </div>
  );
}

function TotalRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={muted ? "flex justify-between gap-4 text-[13px] text-fg-muted" : "flex justify-between gap-4"}>
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
