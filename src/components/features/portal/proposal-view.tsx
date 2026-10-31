import { ImageIcon } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { fileUrl } from "@/lib/files";
import { formatBasisPoints, formatCents, formatInteger, formatISODate } from "@/lib/format";
import type { QuoteSnapshot } from "@/lib/quote-snapshot";

/** Proposta tal como foi emitida (snapshot), em formato legível no telemóvel. */
export function ProposalView({ q }: { q: QuoteSnapshot }) {
  const terms = (q.terms ?? "").split("\n").map((t) => t.trim()).filter(Boolean);
  const eventDates = q.dates.start === q.dates.end ? formatISODate(q.dates.start) : `${formatISODate(q.dates.start)} a ${formatISODate(q.dates.end)}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Evento" />
        <dl className="grid gap-x-8 gap-y-3 px-5 py-4 text-[14px] sm:grid-cols-2">
          <div>
            <dt className="text-fg-muted">Evento</dt>
            <dd className="font-medium">{q.event.name}</dd>
          </div>
          <div>
            <dt className="text-fg-muted">Local</dt>
            <dd className="font-medium">{[q.event.venue, q.event.city].filter(Boolean).join(", ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-fg-muted">Datas do evento</dt>
            <dd className="font-medium">
              {eventDates} ({q.billableDays} {q.billableDays === 1 ? "dia" : "dias"})
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted">Entrega e recolha</dt>
            <dd className="font-medium">
              {formatISODate(q.dates.delivery)} · {formatISODate(q.dates.return)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Artigos" description="Preços sem IVA" />
        <ul className="divide-y divide-border">
          {q.items.map((item, i) => (
            <li key={`${item.sku}-${i}`} className="flex gap-3 px-5 py-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-surface-2">
                {item.imageKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(item.imageKey, "thumb")} alt="" className="size-full object-contain" loading="lazy" />
                ) : (
                  <ImageIcon className="absolute inset-0 m-auto size-5 text-fg-subtle" strokeWidth={1.5} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-[13px] text-fg-muted">
                  {formatInteger(item.quantity)} {item.unit} × {formatCents(item.unitPriceCents)}
                  {item.priceUnit === "POR_DIA" ? ` /dia × ${item.billableDays} ${item.billableDays === 1 ? "dia" : "dias"}` : ""}
                  {item.discountBp > 0 && ` · desconto ${formatBasisPoints(item.discountBp)}`}
                </div>
              </div>
              <div className="tabular shrink-0 text-right font-medium">{formatCents(item.totalCents)}</div>
            </li>
          ))}
          {q.services.map((svc, i) => (
            <li key={`svc-${i}`} className="flex gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{svc.description}</div>
                <div className="text-[13px] text-fg-muted">
                  {formatInteger(svc.quantity)} × {formatCents(svc.unitPriceCents)}
                </div>
              </div>
              <div className="tabular shrink-0 text-right font-medium">{formatCents(svc.totalCents)}</div>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 border-t border-border px-5 py-4 text-[14px]">
          <Row label="Artigos" value={formatCents(q.totals.subtotalCents)} />
          {q.totals.discountCents > 0 && <Row label={`Desconto (${formatBasisPoints(q.globalDiscountBp)})`} value={`−${formatCents(q.totals.discountCents)}`} />}
          {q.totals.servicesCents > 0 && <Row label="Serviços" value={formatCents(q.totals.servicesCents)} />}
          {q.totals.taxLines.map((t) => (
            <Row key={t.rateBp} muted label={`IVA ${formatBasisPoints(t.rateBp)}`} value={formatCents(t.taxCents)} />
          ))}
          <div className="flex items-baseline justify-between border-t border-border pt-3 font-display text-[22px] font-semibold">
            <dt>Total</dt>
            <dd className="tabular">{formatCents(q.totals.totalCents)}</dd>
          </div>
        </dl>
      </Card>

      {(q.notes || terms.length > 0) && (
        <Card>
          <CardHeader title="Observações e condições" />
          <div className="space-y-3 px-5 py-4 text-[14px]">
            {q.notes && <p className="whitespace-pre-line">{q.notes}</p>}
            {terms.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-fg-muted">
                {terms.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={muted ? "flex justify-between gap-4 text-[13px] text-fg-muted" : "flex justify-between gap-4"}>
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
