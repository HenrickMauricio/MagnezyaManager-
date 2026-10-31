"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { saveServiceAction } from "@/server/actions/settings";
import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/page";
import { formatBasisPoints, formatCents } from "@/lib/format";

export type ServiceView = {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  defaultPriceCents: number;
  taxRateId: string;
  taxRateBp: number;
  active: boolean;
};

export function ServicesManager({
  services,
  taxRates,
}: {
  services: ServiceView[];
  taxRates: { id: string; label: string }[];
}) {
  const [editing, setEditing] = useState<ServiceView | "new" | null>(null);
  const current = editing === "new" ? null : editing;

  return (
    <Card>
      <CardHeader
        title="Serviços adicionais"
        description="Transporte, montagem e outros serviços que se juntam aos artigos nos orçamentos."
        action={
          <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> Novo serviço
          </Button>
        }
      />
      {services.length === 0 ? (
        <EmptyState title="Sem serviços" description="Crie, por exemplo, o transporte e a montagem." />
      ) : (
        <ul className="divide-y divide-border">
          {services.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={s.active ? "font-medium" : "font-medium text-fg-subtle"}>{s.name}</span>
                  {!s.active && <Badge>Inativo</Badge>}
                </div>
                <div className="text-[13px] text-fg-muted">
                  {formatCents(s.defaultPriceCents)} / {s.unit} · IVA {formatBasisPoints(s.taxRateBp)}
                  {s.description && ` · ${s.description}`}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(s)} aria-label={`Editar ${s.name}`}>
                <Pencil className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={current ? "Editar serviço" : "Novo serviço"}>
        {editing !== null && (
          <ActionForm action={saveServiceAction.bind(null, current?.id ?? null)} onSuccess={() => setEditing(null)} className="space-y-5">
            {({ errors: e, pending }) => (
              <>
                <Field label="Nome" htmlFor="svc-name" errors={e.name} required>
                  <Input id="svc-name" name="name" defaultValue={current?.name} invalid={!!e.name} autoFocus />
                </Field>
                <Field label="Descrição" htmlFor="svc-description" errors={e.description}>
                  <Input id="svc-description" name="description" defaultValue={current?.description ?? ""} />
                </Field>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field label="Preço (€)" htmlFor="svc-price" errors={e.defaultPriceCents} required>
                    <Input
                      id="svc-price"
                      name="defaultPriceCents"
                      inputMode="decimal"
                      defaultValue={current ? (current.defaultPriceCents / 100).toFixed(2).replace(".", ",") : ""}
                      invalid={!!e.defaultPriceCents}
                    />
                  </Field>
                  <Field label="Unidade" htmlFor="svc-unit" errors={e.unit} required>
                    <Input id="svc-unit" name="unit" defaultValue={current?.unit ?? "serviço"} invalid={!!e.unit} />
                  </Field>
                  <Field label="IVA" htmlFor="svc-tax" errors={e.taxRateId} required>
                    <Select id="svc-tax" name="taxRateId" defaultValue={current?.taxRateId ?? taxRates[0]?.id}>
                      {taxRates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Checkbox name="active" label="Ativo" description="Só serviços ativos aparecem nos orçamentos." defaultChecked={current?.active ?? true} />
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" loading={pending}>
                    {current ? "Guardar" : "Criar serviço"}
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
