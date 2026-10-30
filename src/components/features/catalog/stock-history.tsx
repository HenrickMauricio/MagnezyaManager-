"use client";

import { useState } from "react";
import { ArrowDownUp, Plus, Wrench } from "lucide-react";
import {
  cancelMaintenanceAction,
  completeMaintenanceAction,
  createMaintenanceAction,
  createMovementAction,
  startMaintenanceAction,
} from "@/server/actions/inventory";
import { ActionButton } from "@/components/action-button";
import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmButton, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/page";
import { Table, Td, Th } from "@/components/ui/table";
import { formatCents, formatInteger, formatISODate } from "@/lib/format";
import { MAINTENANCE_STATUSES, MOVEMENT_TYPES } from "@/lib/validation/catalog";

export type MovementView = {
  id: string;
  type: keyof typeof MOVEMENT_TYPES;
  quantity: number;
  date: string;
  reason: string;
  userName: string | null;
};

export type MaintenanceView = {
  id: string;
  quantity: number;
  status: keyof typeof MAINTENANCE_STATUSES;
  startDate: string;
  expectedEndDate: string | null;
  endDate: string | null;
  reason: string;
  costCents: number | null;
  userName: string | null;
};

const MOVEMENT_TONE = { ENTRADA: "success", ABATE: "danger", AJUSTE: "info" } as const;
const MAINTENANCE_TONE = { ABERTA: "warning", EM_CURSO: "info", CONCLUIDA: "success", ABATIDA: "danger" } as const;

const signed = (n: number) => (n > 0 ? `+${formatInteger(n)}` : formatInteger(n));

export function MovementsCard({
  articleId,
  unit,
  movements,
  canManage,
  today,
}: {
  articleId: string;
  unit: string;
  movements: MovementView[];
  canManage: boolean;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<keyof typeof MOVEMENT_TYPES>("ENTRADA");

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Movimentos de stock"
        description="Histórico de entradas, abates e ajustes (últimos 50)."
        action={
          canManage && (
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Registar
            </Button>
          )
        }
      />
      {movements.length === 0 ? (
        <EmptyState
          icon={<ArrowDownUp className="size-8" strokeWidth={1.5} />}
          title="Sem movimentos"
          description="O stock atual é o stock inicial do artigo."
        />
      ) : (
        <Table className="min-w-[560px]">
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Tipo</Th>
              <Th className="text-right">Quantidade</Th>
              <Th>Motivo</Th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <Td className="tabular whitespace-nowrap text-fg-muted">{formatISODate(m.date)}</Td>
                <Td>
                  <Badge tone={MOVEMENT_TONE[m.type]}>{MOVEMENT_TYPES[m.type]}</Badge>
                </Td>
                <Td className="tabular text-right font-medium">
                  {signed(m.quantity)} <span className="font-normal text-fg-subtle">{unit}</span>
                </Td>
                <Td>
                  <div className="max-w-[320px] truncate" title={m.reason}>
                    {m.reason}
                  </div>
                  {m.userName && <div className="text-[12px] text-fg-subtle">{m.userName}</div>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Registar movimento"
        description="Altera o stock total do artigo a partir da data indicada."
      >
        {open && (
          <ActionForm action={createMovementAction.bind(null, articleId)} onSuccess={() => setOpen(false)} className="space-y-5">
            {({ errors: e, pending }) => (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Tipo" htmlFor="mov-type" errors={e.type} required>
                    <Select
                      id="mov-type"
                      name="type"
                      value={type}
                      onChange={(ev) => setType(ev.target.value as keyof typeof MOVEMENT_TYPES)}
                    >
                      <option value="ENTRADA">Entrada (compra, reforço)</option>
                      <option value="ABATE">Abate (perda definitiva)</option>
                      <option value="AJUSTE">Ajuste (correção de inventário)</option>
                    </Select>
                  </Field>
                  <Field
                    label={`Quantidade (${unit})`}
                    htmlFor="mov-quantity"
                    errors={e.quantity}
                    required
                    hint={type === "AJUSTE" ? "Use um número negativo para reduzir (ex.: -3)." : undefined}
                  >
                    <Input id="mov-quantity" name="quantity" type="number" invalid={!!e.quantity} autoFocus />
                  </Field>
                </div>
                <Field label="Data" htmlFor="mov-date" errors={e.effectiveDate} required>
                  <Input id="mov-date" name="effectiveDate" type="date" defaultValue={today} invalid={!!e.effectiveDate} />
                </Field>
                <Field label="Motivo" htmlFor="mov-reason" errors={e.reason} required>
                  <Input
                    id="mov-reason"
                    name="reason"
                    invalid={!!e.reason}
                    placeholder={
                      type === "ENTRADA" ? "Ex.: compra fatura FT 2026/123" : type === "ABATE" ? "Ex.: partidas no evento X" : "Ex.: contagem de inventário"
                    }
                  />
                </Field>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" loading={pending}>
                    Registar movimento
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

export function MaintenanceCard({
  articleId,
  unit,
  maintenances,
  canManage,
  today,
}: {
  articleId: string;
  unit: string;
  maintenances: MaintenanceView[];
  canManage: boolean;
  today: string;
}) {
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState<MaintenanceView | null>(null);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Manutenção"
        description="Unidades danificadas ou em reparação deixam de estar disponíveis até serem concluídas."
        action={
          canManage && (
            <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Registar
            </Button>
          )
        }
      />
      {maintenances.length === 0 ? (
        <EmptyState icon={<Wrench className="size-8" strokeWidth={1.5} />} title="Sem registos de manutenção" />
      ) : (
        <ul className="divide-y divide-border">
          {maintenances.map((m) => {
            const isOpen = m.status === "ABERTA" || m.status === "EM_CURSO";
            return (
              <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular font-medium">
                      {formatInteger(m.quantity)} {unit}
                    </span>
                    <Badge tone={MAINTENANCE_TONE[m.status]}>{MAINTENANCE_STATUSES[m.status]}</Badge>
                  </div>
                  <div className="text-[14px]">{m.reason}</div>
                  <div className="text-[12px] text-fg-muted">
                    Desde {formatISODate(m.startDate)}
                    {m.endDate
                      ? ` · fechada a ${formatISODate(m.endDate)}`
                      : m.expectedEndDate
                        ? ` · previsão ${formatISODate(m.expectedEndDate)}`
                        : " · sem previsão de fim"}
                    {m.costCents !== null && ` · custo ${formatCents(m.costCents)}`}
                    {m.userName && ` · ${m.userName}`}
                  </div>
                </div>
                {canManage && isOpen && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.status === "ABERTA" && (
                      <ActionButton size="sm" variant="ghost" action={startMaintenanceAction.bind(null, articleId, m.id)}>
                        Em reparação
                      </ActionButton>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setCompleting(m)}>
                      Concluir
                    </Button>
                    <ConfirmButton
                      size="sm"
                      variant="ghost"
                      title="Anular registo?"
                      description="Use apenas se o registo foi feito por engano. As unidades voltam a contar como disponíveis."
                      confirmLabel="Anular"
                      action={cancelMaintenanceAction.bind(null, articleId, m.id)}
                    >
                      Anular
                    </ConfirmButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={creating} onClose={() => setCreating(false)} title="Registar manutenção">
        {creating && (
          <ActionForm
            action={createMaintenanceAction.bind(null, articleId)}
            onSuccess={() => setCreating(false)}
            className="space-y-5"
          >
            {({ errors: e, pending }) => (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={`Quantidade (${unit})`} htmlFor="mnt-quantity" errors={e.quantity} required>
                    <Input id="mnt-quantity" name="quantity" type="number" min={1} invalid={!!e.quantity} autoFocus />
                  </Field>
                  <Field label="Custo estimado (€)" htmlFor="mnt-cost" errors={e.costCents}>
                    <Input id="mnt-cost" name="costCents" inputMode="decimal" placeholder="0,00" invalid={!!e.costCents} />
                  </Field>
                  <Field label="Início" htmlFor="mnt-start" errors={e.startDate} required>
                    <Input id="mnt-start" name="startDate" type="date" defaultValue={today} invalid={!!e.startDate} />
                  </Field>
                  <Field label="Fim previsto" htmlFor="mnt-expected" errors={e.expectedEndDate} hint="Opcional.">
                    <Input id="mnt-expected" name="expectedEndDate" type="date" invalid={!!e.expectedEndDate} />
                  </Field>
                </div>
                <Field label="Motivo" htmlFor="mnt-reason" errors={e.reason} required>
                  <Input id="mnt-reason" name="reason" placeholder="Ex.: estofo rasgado" invalid={!!e.reason} />
                </Field>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" loading={pending}>
                    Registar
                  </Button>
                </div>
              </>
            )}
          </ActionForm>
        )}
      </Dialog>

      <Dialog
        open={completing !== null}
        onClose={() => setCompleting(null)}
        title="Concluir manutenção"
        description={
          completing &&
          `${formatInteger(completing.quantity)} ${unit} · ${completing.reason}. As unidades reparadas voltam ao stock; as perdidas são abatidas.`
        }
      >
        {completing && (
          <ActionForm
            action={completeMaintenanceAction.bind(null, articleId, completing.id)}
            onSuccess={() => setCompleting(null)}
            className="space-y-5"
          >
            {({ errors: e, pending }) => (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Data de conclusão" htmlFor="cmp-end" errors={e.endDate} required>
                    <Input id="cmp-end" name="endDate" type="date" defaultValue={today} invalid={!!e.endDate} />
                  </Field>
                  <Field
                    label={`Unidades perdidas (${unit})`}
                    htmlFor="cmp-lost"
                    errors={e.lostQuantity}
                    required
                    hint="0 se todas foram reparadas."
                  >
                    <Input
                      id="cmp-lost"
                      name="lostQuantity"
                      type="number"
                      min={0}
                      max={completing.quantity}
                      defaultValue={0}
                      invalid={!!e.lostQuantity}
                    />
                  </Field>
                </div>
                <Field label="Custo final (€)" htmlFor="cmp-cost" errors={e.costCents} hint="Opcional; substitui a estimativa.">
                  <Input id="cmp-cost" name="costCents" inputMode="decimal" placeholder="0,00" invalid={!!e.costCents} />
                </Field>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={() => setCompleting(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" loading={pending}>
                    Concluir
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
