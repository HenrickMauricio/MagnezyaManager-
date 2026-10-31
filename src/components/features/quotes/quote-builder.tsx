"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveQuoteAction } from "@/server/actions/quotes";
import { checkAvailabilityAction, type LineCheck } from "@/server/actions/rentals";
import { ActionForm } from "@/components/action-form";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, FieldError, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatBasisPoints, formatCents, formatInteger, formatISODate, parseEurosToCents } from "@/lib/format";
import { billableDaysBetween, computeTotals, type PriceUnit } from "@/lib/pricing";

export type BuilderArticle = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  priceCents: number;
  priceUnit: PriceUnit;
  taxRateBp: number;
};
export type BuilderService = { id: string; name: string; unit: string; defaultPriceCents: number; taxRateBp: number };

export type QuoteBuilderValues = {
  clientId: string;
  eventName: string;
  venue: string;
  city: string;
  deliveryDate: string;
  startDate: string;
  endDate: string;
  returnDate: string;
  validUntil: string;
  discount: string;
  notes: string;
  internalNotes: string;
  terms: string;
  lockVersion?: number;
  items: { articleId: string; quantity: string; discount: string; unitPriceCents?: number; priceUnit?: PriceUnit }[];
  services: { serviceId: string | null; description: string; quantity: string; price: string }[];
};

type ItemLine = { key: number; articleId: string; text: string; quantity: string; discount: string };
type ServiceLine = { key: number; serviceId: string | null; description: string; quantity: string; price: string };

let nextKey = 1;
const label = (a: BuilderArticle) => `${a.sku} · ${a.name}`;
const percent = (v: string) => {
  const n = Number(v.replace(",", ".").trim() || "0");
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) : 0;
};
const euros = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export function QuoteBuilder({
  quoteId,
  initial,
  clients,
  articles,
  catalogServices,
  fallbackTaxBp,
  cancelHref,
}: {
  quoteId: string | null;
  initial: QuoteBuilderValues;
  clients: { id: string; name: string }[];
  articles: BuilderArticle[];
  catalogServices: BuilderService[];
  fallbackTaxBp: number;
  cancelHref: string;
}) {
  const byId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);
  // Preço com que cada artigo já está no orçamento (mantém-se numa edição).
  const snapshotPrices = useMemo(
    () => new Map(initial.items.filter((i) => i.unitPriceCents !== undefined).map((i) => [i.articleId, { cents: i.unitPriceCents!, unit: i.priceUnit! }])),
    [initial.items],
  );

  const [dates, setDates] = useState({
    deliveryDate: initial.deliveryDate,
    startDate: initial.startDate,
    endDate: initial.endDate,
    returnDate: initial.returnDate,
  });
  const [items, setItems] = useState<ItemLine[]>(() =>
    initial.items.length
      ? initial.items.map((i) => {
          const a = byId.get(i.articleId);
          return { key: nextKey++, articleId: i.articleId, text: a ? label(a) : i.articleId, quantity: i.quantity, discount: i.discount };
        })
      : [{ key: nextKey++, articleId: "", text: "", quantity: "1", discount: "" }],
  );
  const [services, setServices] = useState<ServiceLine[]>(() => initial.services.map((s) => ({ key: nextKey++, ...s })));
  const [discount, setDiscount] = useState(initial.discount);
  const [checks, setChecks] = useState<Record<string, LineCheck>>({});

  const days = dates.startDate && dates.endDate && dates.endDate >= dates.startDate ? billableDaysBetween(dates.startDate, dates.endDate) : 1;
  const filled = items.filter((l) => l.articleId && Number(l.quantity) > 0);

  const priced = filled.map((l) => {
    const a = byId.get(l.articleId);
    const snap = snapshotPrices.get(l.articleId);
    return {
      line: l,
      unitPriceCents: snap?.cents ?? a?.priceCents ?? 0,
      priceUnit: snap?.unit ?? a?.priceUnit ?? ("POR_DIA" as PriceUnit),
      quantity: Number(l.quantity),
      billableDays: days,
      discountBp: percent(l.discount),
      taxRateBp: a?.taxRateBp ?? fallbackTaxBp,
    };
  });
  const pricedServices = services
    .filter((s) => s.description.trim() && Number(s.quantity) > 0)
    .map((s) => ({
      unitPriceCents: parseEurosToCents(s.price) ?? 0,
      quantity: Number(s.quantity),
      taxRateBp: catalogServices.find((c) => c.id === s.serviceId)?.taxRateBp ?? fallbackTaxBp,
    }));
  const totals = computeTotals(priced, pricedServices, percent(discount));
  const lineTotal = new Map(priced.map((p, i) => [p.line.key, totals.itemTotals[i]!]));

  // Disponibilidade em tempo real (mesmo motor das reservas).
  const checkKey = JSON.stringify([dates.deliveryDate, dates.returnDate, filled.map((l) => l.articleId).sort()]);
  useEffect(() => {
    if (!dates.deliveryDate || !dates.returnDate || dates.returnDate < dates.deliveryDate || filled.length === 0) return;
    const payload = { deliveryDate: dates.deliveryDate, returnDate: dates.returnDate, lines: filled.map((l) => ({ articleId: l.articleId, quantity: 1 })) };
    const timer = setTimeout(async () => {
      const result = await checkAvailabilityAction(payload);
      if (result) setChecks(Object.fromEntries(result.map((r) => [r.articleId, r])));
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkKey resume as dependências relevantes
  }, [checkKey]);

  function setDate(name: keyof typeof dates, value: string) {
    setDates((d) => {
      const next = { ...d, [name]: value };
      if (name === "deliveryDate" && (!next.startDate || next.startDate < value)) next.startDate = value;
      if (name !== "returnDate" && next.startDate && (!next.endDate || next.endDate < next.startDate)) next.endDate = next.startDate;
      if (next.endDate && (!next.returnDate || next.returnDate < next.endDate)) next.returnDate = next.endDate;
      return next;
    });
  }

  const updateItem = (key: number, patch: Partial<ItemLine>) => setItems((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const updateService = (key: number, patch: Partial<ServiceLine>) => setServices((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <ActionForm action={saveQuoteAction.bind(null, quoteId)}>
      {({ errors: e, pending }) => (
        <>
          {initial.lockVersion !== undefined && <input type="hidden" name="lockVersion" value={initial.lockVersion} />}

          <Card>
            <CardHeader title="Cliente e evento" />
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <Field label="Cliente" htmlFor="clientId" errors={e.clientId} required className="sm:col-span-2">
                <Select id="clientId" name="clientId" defaultValue={initial.clientId} invalid={!!e.clientId}>
                  <option value="">Escolher cliente…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Evento" htmlFor="eventName" errors={e.eventName} required className="sm:col-span-2">
                <Input id="eventName" name="eventName" defaultValue={initial.eventName} placeholder="Ex.: Congresso anual 2026" invalid={!!e.eventName} />
              </Field>
              <Field label="Local" htmlFor="venue" errors={e.venue}>
                <Input id="venue" name="venue" defaultValue={initial.venue} />
              </Field>
              <Field label="Localidade" htmlFor="city" errors={e.city}>
                <Input id="city" name="city" defaultValue={initial.city} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Datas"
              description={`Preço por dia × ${days} ${days === 1 ? "dia" : "dias"} de evento. O material fica ocupado da entrega à recolha.`}
            />
            <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-5">
              {(
                [
                  ["deliveryDate", "Entrega / montagem"],
                  ["startDate", "Início do evento"],
                  ["endDate", "Fim do evento"],
                  ["returnDate", "Recolha"],
                ] as const
              ).map(([name, text]) => (
                <Field key={name} label={text} htmlFor={name} errors={e[name]} required>
                  <Input id={name} name={name} type="date" value={dates[name]} onChange={(ev) => setDate(name, ev.target.value)} invalid={!!e[name]} />
                </Field>
              ))}
              <Field label="Válido até" htmlFor="validUntil" errors={e.validUntil} required>
                <Input id="validUntil" name="validUntil" type="date" defaultValue={initial.validUntil} invalid={!!e.validUntil} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Artigos" description="Preço do catálogo, sem IVA. A disponibilidade é a do período entrega → recolha." />
            <datalist id="quote-articles">
              {articles.map((a) => (
                <option key={a.id} value={label(a)} />
              ))}
            </datalist>
            <ul className="divide-y divide-border">
              {items.map((line, index) => {
                const a = byId.get(line.articleId);
                const snap = snapshotPrices.get(line.articleId);
                const unitPrice = snap?.cents ?? a?.priceCents;
                const priceUnit = snap?.unit ?? a?.priceUnit;
                const check = line.articleId ? checks[line.articleId] : undefined;
                const short = check !== undefined && check.available < Number(line.quantity);
                return (
                  <li key={line.key} className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_90px_110px_150px_120px_40px] lg:items-start">
                    <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                      <ColumnLabel>Artigo</ColumnLabel>
                      <Input
                        aria-label={`Artigo ${index + 1}`}
                        list="quote-articles"
                        placeholder="Pesquisar por SKU ou nome…"
                        value={line.text}
                        onChange={(ev) => {
                          const text = ev.target.value;
                          const match = articles.find((x) => label(x) === text);
                          updateItem(line.key, { text, articleId: match?.id ?? "" });
                        }}
                        invalid={line.text !== "" && !line.articleId}
                      />
                      {a && unitPrice !== undefined && (
                        <div className="mt-1 text-[12px] text-fg-muted">
                          {formatCents(unitPrice)}
                          {priceUnit === "POR_DIA" ? " / dia" : " / evento"} · IVA {formatBasisPoints(a.taxRateBp)}
                          {snap && snap.cents !== a.priceCents && " · preço do orçamento"}
                        </div>
                      )}
                    </div>
                    <div>
                      <ColumnLabel>Qtd.</ColumnLabel>
                      <Input
                        aria-label={`Quantidade ${index + 1}`}
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(ev) => updateItem(line.key, { quantity: ev.target.value })}
                      />
                    </div>
                    <div>
                      <ColumnLabel>Desconto (%)</ColumnLabel>
                      <Input
                        aria-label={`Desconto ${index + 1} (%)`}
                        inputMode="decimal"
                        placeholder="0"
                        value={line.discount}
                        onChange={(ev) => updateItem(line.key, { discount: ev.target.value })}
                      />
                    </div>
                    <div className="text-[13px]">
                      <ColumnLabel>Disponibilidade</ColumnLabel>
                      {!a ? (
                        <span className="text-fg-subtle">{line.text ? "Escolha da lista" : "—"}</span>
                      ) : check ? (
                        <span className={cn("font-medium", short ? "text-danger" : "text-success")}>
                          {short ? `Faltam ${formatInteger(Number(line.quantity) - Math.max(0, check.available))}` : "Disponível"}
                          <span className="block text-[12px] font-normal text-fg-muted">
                            {formatInteger(Math.max(0, check.available))} {a.unit} livres
                          </span>
                        </span>
                      ) : (
                        <span className="text-fg-subtle">Indique as datas</span>
                      )}
                    </div>
                    <div className="tabular font-medium lg:text-right">
                      <ColumnLabel>Total</ColumnLabel>
                      <div className="lg:flex lg:h-11 lg:items-center lg:justify-end">
                        {lineTotal.has(line.key) ? formatCents(lineTotal.get(line.key)!) : "—"}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="justify-self-start lg:mt-[26px]"
                      aria-label={`Remover artigo ${index + 1}`}
                      disabled={items.length === 1}
                      onClick={() => setItems((ls) => ls.filter((l) => l.key !== line.key))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-border px-5 py-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setItems((ls) => [...ls, { key: nextKey++, articleId: "", text: "", quantity: "1", discount: "" }])}
              >
                <Plus className="size-4" /> Adicionar artigo
              </Button>
              <FieldError messages={e.items} />
            </div>
            <input
              type="hidden"
              name="items"
              value={JSON.stringify(filled.map((l) => ({ articleId: l.articleId, quantity: Number(l.quantity), discountBp: l.discount || "0" })))}
            />
          </Card>

          <Card>
            <CardHeader title="Serviços" description="Transporte, montagem, desmontagem… (sem desconto)." />
            {services.length > 0 && (
              <ul className="divide-y divide-border">
                {services.map((svc, index) => (
                  <li key={svc.key} className="grid gap-3 px-5 py-4 sm:grid-cols-[200px_minmax(0,1fr)_90px_120px_40px] sm:items-start">
                    <div>
                      <ColumnLabel>Serviço</ColumnLabel>
                      <Select
                        aria-label={`Serviço ${index + 1}`}
                        value={svc.serviceId ?? ""}
                        onChange={(ev) => {
                          const c = catalogServices.find((x) => x.id === ev.target.value);
                          updateService(svc.key, c ? { serviceId: c.id, description: c.name, price: euros(c.defaultPriceCents) } : { serviceId: null });
                        }}
                      >
                        <option value="">Outro (escrever)</option>
                        {catalogServices.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <ColumnLabel>Descrição</ColumnLabel>
                      <Input
                        aria-label={`Descrição do serviço ${index + 1}`}
                        value={svc.description}
                        onChange={(ev) => updateService(svc.key, { description: ev.target.value })}
                      />
                    </div>
                    <div>
                      <ColumnLabel>Qtd.</ColumnLabel>
                      <Input
                        aria-label={`Quantidade do serviço ${index + 1}`}
                        type="number"
                        min={1}
                        value={svc.quantity}
                        onChange={(ev) => updateService(svc.key, { quantity: ev.target.value })}
                      />
                    </div>
                    <div>
                      <ColumnLabel>Preço (€)</ColumnLabel>
                      <Input
                        aria-label={`Preço do serviço ${index + 1} (€)`}
                        inputMode="decimal"
                        value={svc.price}
                        onChange={(ev) => updateService(svc.key, { price: ev.target.value })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="justify-self-start sm:mt-[26px]"
                      aria-label={`Remover serviço ${index + 1}`}
                      onClick={() => setServices((ls) => ls.filter((l) => l.key !== svc.key))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-border px-5 py-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const first = catalogServices[0];
                  setServices((ls) => [
                    ...ls,
                    first
                      ? { key: nextKey++, serviceId: first.id, description: first.name, quantity: "1", price: euros(first.defaultPriceCents) }
                      : { key: nextKey++, serviceId: null, description: "", quantity: "1", price: "" },
                  ]);
                }}
              >
                <Plus className="size-4" /> Adicionar serviço
              </Button>
              <FieldError messages={e.services} />
            </div>
            <input
              type="hidden"
              name="services"
              value={JSON.stringify(
                services
                  .filter((s) => s.description.trim())
                  .map((s) => ({ serviceId: s.serviceId, description: s.description.trim(), quantity: Number(s.quantity) || 1, price: s.price || "0" })),
              )}
            />
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader title="Notas e condições" />
              <div className="space-y-5 p-5">
                <Field label="Observações (aparecem na proposta)" htmlFor="notes" errors={e.notes}>
                  <Textarea id="notes" name="notes" rows={3} defaultValue={initial.notes} />
                </Field>
                <Field label="Condições" htmlFor="terms" errors={e.terms} hint="Uma por linha. Vêm das Definições; pode ajustá-las para este cliente.">
                  <Textarea id="terms" name="terms" rows={5} defaultValue={initial.terms} />
                </Field>
                <Field label="Notas internas" htmlFor="internalNotes" errors={e.internalNotes} hint="Não aparecem na proposta.">
                  <Textarea id="internalNotes" name="internalNotes" rows={2} defaultValue={initial.internalNotes} />
                </Field>
              </div>
            </Card>

            <Card className="h-fit lg:sticky lg:top-24">
              <CardHeader title="Resumo" description="Valores calculados ao gravar; IVA por taxa." />
              <div className="space-y-2 p-5 text-[14px]">
                <Field label="Desconto global sobre artigos (%)" htmlFor="discount" errors={e.discount}>
                  <Input id="discount" name="discount" inputMode="decimal" placeholder="0" value={discount} onChange={(ev) => setDiscount(ev.target.value)} />
                </Field>
                <div className="space-y-1.5 pt-3">
                  <Row label="Artigos" value={formatCents(totals.subtotalCents)} />
                  {totals.discountCents > 0 && <Row label={`Desconto (${formatBasisPoints(percent(discount))})`} value={`−${formatCents(totals.discountCents)}`} />}
                  {totals.servicesCents > 0 && <Row label="Serviços" value={formatCents(totals.servicesCents)} />}
                  {totals.taxLines.map((t) => (
                    <Row key={t.rateBp} muted label={`IVA ${formatBasisPoints(t.rateBp)} sobre ${formatCents(t.baseCents)}`} value={formatCents(t.taxCents)} />
                  ))}
                </div>
                <div className="flex items-baseline justify-between border-t border-border pt-3 font-display text-[22px] font-semibold">
                  <span>Total</span>
                  <span className="tabular">{formatCents(totals.totalCents)}</span>
                </div>
                {totals.effectiveDiscountBp > 0 && (
                  <p className="text-[12px] text-fg-muted">Desconto efetivo sobre os artigos: {formatBasisPoints(totals.effectiveDiscountBp)}</p>
                )}
                {dates.deliveryDate && dates.returnDate && (
                  <p className="text-[12px] text-fg-subtle">
                    Material ocupado de {formatISODate(dates.deliveryDate)} a {formatISODate(dates.returnDate)} (mais preparação).
                  </p>
                )}
              </div>
            </Card>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link href={cancelHref} className={buttonClasses({ variant: "secondary" })}>
              Cancelar
            </Link>
            <Button type="submit" loading={pending}>
              {quoteId ? "Guardar alterações" : "Criar orçamento"}
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Rótulo visível por cima de cada caixa das linhas de artigos e serviços. */
function ColumnLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[12px] font-medium text-fg-muted">{children}</span>;
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", muted && "text-[13px] text-fg-muted")}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
