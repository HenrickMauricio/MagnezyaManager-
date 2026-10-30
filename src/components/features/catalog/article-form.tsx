"use client";

import Link from "next/link";
import type { ActionResult } from "@/server/errors";
import { ActionForm } from "@/components/action-form";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ARTICLE_STATUSES, PRICE_UNITS, UNIT_SUGGESTIONS } from "@/lib/validation/catalog";

export type ArticleFormValues = {
  name: string;
  sku: string;
  categoryId: string;
  description: string;
  unit: string;
  /** Euros como texto ("12,50"). */
  price: string;
  priceUnit: string;
  taxRateId: string;
  status: string;
  internalNotes: string;
  stockBase: string;
};

const REGION_LABELS: Record<string, string> = { CONTINENTE: "Continente", ACORES: "Açores", MADEIRA: "Madeira" };

export function ArticleForm({
  action,
  initial,
  categories,
  taxRates,
  mode,
  cancelHref,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  initial: ArticleFormValues;
  categories: { id: string; name: string; skuPrefix: string }[];
  taxRates: { id: string; name: string; rateBp: number; region: string }[];
  mode: "create" | "edit";
  cancelHref: string;
}) {
  return (
    <ActionForm action={action}>
      {({ errors: e, pending }) => {
        const props = (name: keyof ArticleFormValues | "priceCents") => ({
          id: name,
          name,
          invalid: !!e[name],
          "aria-describedby": `${name}-error`,
        });
        return (
          <>
            <Card>
              <CardHeader title="Identificação" />
              <div className="grid gap-5 p-5 sm:grid-cols-2">
                <Field label="Nome" htmlFor="name" errors={e.name} required className="sm:col-span-2">
                  <Input {...props("name")} defaultValue={initial.name} />
                </Field>
                <Field label="Categoria" htmlFor="categoryId" errors={e.categoryId} required>
                  <Select {...props("categoryId")} defaultValue={initial.categoryId}>
                    <option value="">Escolher…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="SKU (referência)"
                  htmlFor="sku"
                  errors={e.sku}
                  hint={mode === "create" ? "Deixe vazio para gerar automaticamente (ex.: CAD-0001)." : undefined}
                >
                  <Input {...props("sku")} defaultValue={initial.sku} className="uppercase" autoComplete="off" />
                </Field>
                <Field label="Descrição" htmlFor="description" errors={e.description} className="sm:col-span-2">
                  <Textarea {...props("description")} defaultValue={initial.description} rows={3} />
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader title="Preço e IVA" description="Preço sem IVA, por unidade." />
              <div className="grid gap-5 p-5 sm:grid-cols-3">
                <Field label="Preço (€)" htmlFor="priceCents" errors={e.priceCents} required>
                  <Input {...props("priceCents")} defaultValue={initial.price} inputMode="decimal" placeholder="0,00" />
                </Field>
                <Field label="Cobrança" htmlFor="priceUnit" errors={e.priceUnit} required>
                  <Select {...props("priceUnit")} defaultValue={initial.priceUnit}>
                    {Object.entries(PRICE_UNITS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Taxa de IVA" htmlFor="taxRateId" errors={e.taxRateId} required>
                  <Select {...props("taxRateId")} defaultValue={initial.taxRateId}>
                    {taxRates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.rateBp / 100}% · {REGION_LABELS[t.region] ?? t.region}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Stock e estado"
                description={
                  mode === "edit"
                    ? "O stock altera-se na ficha do artigo, com um movimento de entrada, abate ou ajuste."
                    : undefined
                }
              />
              <div className="grid gap-5 p-5 sm:grid-cols-3">
                {mode === "create" && (
                  <Field
                    label="Stock inicial"
                    htmlFor="stockBase"
                    errors={e.stockBase}
                    required
                    hint="Quantidade que existe hoje. Depois só muda por movimentos."
                  >
                    <Input {...props("stockBase")} type="number" min={0} defaultValue={initial.stockBase} />
                  </Field>
                )}
                <Field label="Unidade" htmlFor="unit" errors={e.unit} required>
                  <Input {...props("unit")} defaultValue={initial.unit} list="unit-suggestions" />
                  <datalist id="unit-suggestions">
                    {UNIT_SUGGESTIONS.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Estado" htmlFor="status" errors={e.status} required hint="Só artigos ativos entram em orçamentos.">
                  <Select {...props("status")} defaultValue={initial.status}>
                    {Object.entries(ARTICLE_STATUSES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Notas internas"
                  htmlFor="internalNotes"
                  errors={e.internalNotes}
                  hint="Não aparecem em propostas."
                  className="sm:col-span-3"
                >
                  <Textarea {...props("internalNotes")} defaultValue={initial.internalNotes} rows={3} />
                </Field>
              </div>
            </Card>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Link href={cancelHref} className={buttonClasses({ variant: "secondary" })}>
                Cancelar
              </Link>
              <Button type="submit" loading={pending}>
                {mode === "create" ? "Criar artigo" : "Guardar alterações"}
              </Button>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
