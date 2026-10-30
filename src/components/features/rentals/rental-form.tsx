"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { checkAvailabilityAction, createRentalAction, type LineCheck } from "@/server/actions/rentals";
import { ActionForm } from "@/components/action-form";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldError, Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatInteger, formatISODate } from "@/lib/format";

type ArticleOption = { id: string; sku: string; name: string; unit: string };
type Line = { key: number; articleId: string; text: string; quantity: string };

const label = (a: ArticleOption) => `${a.sku} · ${a.name}`;
let nextKey = 1;
const emptyLine = (): Line => ({ key: nextKey++, articleId: "", text: "", quantity: "1" });

/**
 * Reserva direta. A disponibilidade de cada linha é verificada em tempo real
 * para as datas escolhidas; a verificação definitiva é feita no servidor,
 * com os artigos bloqueados, ao gravar.
 */
export function RentalForm({ clients, articles }: { clients: { id: string; name: string }[]; articles: ArticleOption[] }) {
  const [dates, setDates] = useState({ deliveryDate: "", startDate: "", endDate: "", returnDate: "" });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [checks, setChecks] = useState<Record<string, LineCheck>>({});
  const [checking, setChecking] = useState(false);

  const filled = lines.filter((l) => l.articleId && Number(l.quantity) > 0);
  const checkKey = JSON.stringify([dates.deliveryDate, dates.returnDate, filled.map((l) => l.articleId).sort()]);

  useEffect(() => {
    if (!dates.deliveryDate || !dates.returnDate || dates.returnDate < dates.deliveryDate || filled.length === 0) return;
    const payload = {
      deliveryDate: dates.deliveryDate,
      returnDate: dates.returnDate,
      lines: filled.map((l) => ({ articleId: l.articleId, quantity: 1 })),
    };
    const timer = setTimeout(async () => {
      setChecking(true);
      const result = await checkAvailabilityAction(payload);
      setChecking(false);
      if (result) setChecks(Object.fromEntries(result.map((r) => [r.articleId, r])));
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkKey resume as dependências relevantes
  }, [checkKey]);

  function setDate(name: keyof typeof dates, value: string) {
    setDates((d) => {
      const next = { ...d, [name]: value };
      // Preenche as datas seguintes para poupar cliques (continuam editáveis).
      if (name === "deliveryDate" && (!next.startDate || next.startDate < value)) next.startDate = value;
      if (name !== "returnDate" && next.startDate && (!next.endDate || next.endDate < next.startDate)) next.endDate = next.startDate;
      if (next.endDate && (!next.returnDate || next.returnDate < next.endDate)) next.returnDate = next.endDate;
      return next;
    });
  }

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const totals = new Map<string, number>();
  for (const l of filled) totals.set(l.articleId, (totals.get(l.articleId) ?? 0) + Number(l.quantity));

  return (
    <ActionForm action={createRentalAction}>
      {({ errors: e, pending }) => (
        <>
          <Card>
            <CardHeader title="Cliente e evento" />
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <Field label="Cliente" htmlFor="clientId" errors={e.clientId} required className="sm:col-span-2">
                <Select id="clientId" name="clientId" defaultValue="" invalid={!!e.clientId}>
                  <option value="">Escolher cliente…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Evento" htmlFor="eventName" errors={e.eventName} required className="sm:col-span-2">
                <Input id="eventName" name="eventName" placeholder="Ex.: Congresso anual 2026" invalid={!!e.eventName} />
              </Field>
              <Field label="Local" htmlFor="venue" errors={e.venue}>
                <Input id="venue" name="venue" placeholder="Ex.: Centro de Congressos" />
              </Field>
              <Field label="Localidade" htmlFor="city" errors={e.city}>
                <Input id="city" name="city" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Datas"
              description="O material fica ocupado da entrega até à recolha, mais os dias de preparação de cada categoria."
            />
            <div className="grid gap-5 p-5 sm:grid-cols-4">
              {(
                [
                  ["deliveryDate", "Entrega / montagem"],
                  ["startDate", "Início do evento"],
                  ["endDate", "Fim do evento"],
                  ["returnDate", "Recolha"],
                ] as const
              ).map(([name, text]) => (
                <Field key={name} label={text} htmlFor={name} errors={e[name]} required>
                  <Input
                    id={name}
                    name={name}
                    type="date"
                    value={dates[name]}
                    onChange={(ev) => setDate(name, ev.target.value)}
                    invalid={!!e[name]}
                  />
                </Field>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Artigos"
              description={
                dates.deliveryDate && dates.returnDate
                  ? `Disponibilidade entre ${formatISODate(dates.deliveryDate)} e ${formatISODate(dates.returnDate)}${checking ? " — a verificar…" : ""}`
                  : "Escolha as datas para ver a disponibilidade de cada artigo."
              }
            />
            <datalist id="article-options">
              {articles.map((a) => (
                <option key={a.id} value={label(a)} />
              ))}
            </datalist>
            <ul className="divide-y divide-border">
              {lines.map((line, index) => {
                const article = articles.find((a) => a.id === line.articleId);
                const check = line.articleId ? checks[line.articleId] : undefined;
                const wanted = totals.get(line.articleId) ?? 0;
                const short = check !== undefined && check.available < wanted;
                return (
                  <li key={line.key} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_120px_190px_40px] sm:items-center">
                    <Input
                      aria-label={`Artigo ${index + 1}`}
                      list="article-options"
                      placeholder="Pesquisar por SKU ou nome…"
                      value={line.text}
                      onChange={(ev) => {
                        const text = ev.target.value;
                        const match = articles.find((a) => label(a) === text);
                        updateLine(line.key, { text, articleId: match?.id ?? "" });
                      }}
                      invalid={line.text !== "" && !line.articleId}
                    />
                    <Input
                      aria-label={`Quantidade ${index + 1}`}
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(ev) => updateLine(line.key, { quantity: ev.target.value })}
                    />
                    <div className="text-[13px]">
                      {!article ? (
                        <span className="text-fg-subtle">{line.text ? "Escolha um artigo da lista" : "—"}</span>
                      ) : check ? (
                        <span className={cn("font-medium", short ? "text-danger" : "text-success")}>
                          {short ? "Faltam " + formatInteger(wanted - Math.max(0, check.available)) : "Disponível"} ·{" "}
                          {formatInteger(Math.max(0, check.available))} {article.unit} livres
                          {short && check.date && <span className="block text-[12px] font-normal">a {formatISODate(check.date)}</span>}
                        </span>
                      ) : (
                        <span className="text-fg-subtle">Indique as datas</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remover linha ${index + 1}`}
                      disabled={lines.length === 1}
                      onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-border px-5 py-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
                <Plus className="size-4" /> Adicionar artigo
              </Button>
              <FieldError messages={e.lines} />
            </div>
            <input
              type="hidden"
              name="lines"
              value={JSON.stringify(filled.map((l) => ({ articleId: l.articleId, quantity: Number(l.quantity) })))}
            />
          </Card>

          <Card>
            <CardHeader title="Notas" />
            <div className="p-5">
              <Textarea id="notes" name="notes" rows={3} placeholder="Instruções de entrega, contacto no local…" />
            </div>
          </Card>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link href="/reservas" className={buttonClasses({ variant: "secondary" })}>
              Cancelar
            </Link>
            <Button type="submit" loading={pending}>
              Criar reserva
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
