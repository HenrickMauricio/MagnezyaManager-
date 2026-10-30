"use client";

import { useState } from "react";
import { PackageCheck, Truck, Undo2, XCircle } from "lucide-react";
import {
  cancelRentalAction,
  markDeliveredAction,
  registerReturnAction,
  startPreparationAction,
} from "@/server/actions/rentals";
import { ActionButton } from "@/components/action-button";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmButton, Dialog } from "@/components/ui/dialog";
import { Field, FieldError, Input } from "@/components/ui/field";
import { formatInteger } from "@/lib/format";
import type { RentalStatus } from "@/lib/validation/rentals";

type Item = { id: string; name: string; unit: string; pending: number };

export function RentalActions({
  rentalId,
  number,
  status,
  items,
  today,
}: {
  rentalId: string;
  number: string;
  status: RentalStatus;
  items: Item[];
  today: string;
}) {
  const [dialog, setDialog] = useState<"deliver" | "return" | null>(null);
  const [lines, setLines] = useState<Record<string, { returned: string; damaged: string }>>({});
  const pendingItems = items.filter((i) => i.pending > 0);

  function openReturn() {
    // Por omissão, devolve tudo o que falta (o caso mais comum).
    setLines(Object.fromEntries(pendingItems.map((i) => [i.id, { returned: String(i.pending), damaged: "0" }])));
    setDialog("return");
  }

  return (
    <>
      {status === "RESERVADO" && (
        <ActionButton variant="secondary" action={startPreparationAction.bind(null, rentalId)}>
          <PackageCheck className="size-4" /> Em preparação
        </ActionButton>
      )}
      {(status === "RESERVADO" || status === "EM_PREPARACAO") && (
        <Button onClick={() => setDialog("deliver")}>
          <Truck className="size-4" /> Registar entrega
        </Button>
      )}
      {(status === "ENTREGUE" || status === "EM_DEVOLUCAO") && (
        <Button onClick={openReturn}>
          <Undo2 className="size-4" /> Registar devolução
        </Button>
      )}
      {(status === "RESERVADO" || status === "EM_PREPARACAO" || status === "CONFLITO_STOCK") && (
        <ConfirmButton
          variant="secondary"
          title={`Cancelar ${number}?`}
          description="O material reservado volta a ficar disponível. Esta ação não pode ser anulada."
          confirmLabel="Cancelar reserva"
          action={cancelRentalAction.bind(null, rentalId)}
        >
          <XCircle className="size-4" /> Cancelar
        </ConfirmButton>
      )}

      <Dialog open={dialog === "deliver"} onClose={() => setDialog(null)} title="Registar entrega" description="O material passa a estar com o cliente.">
        {dialog === "deliver" && (
          <ActionForm action={markDeliveredAction.bind(null, rentalId)} onSuccess={() => setDialog(null)} className="space-y-5">
            {({ errors: e, pending }) => (
              <>
                <Field label="Data da entrega" htmlFor="delivery-date" errors={e.date} required>
                  <Input id="delivery-date" name="date" type="date" defaultValue={today} max={today} />
                </Field>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={() => setDialog(null)}>
                    Voltar
                  </Button>
                  <Button type="submit" loading={pending}>
                    Confirmar entrega
                  </Button>
                </div>
              </>
            )}
          </ActionForm>
        )}
      </Dialog>

      <Dialog
        open={dialog === "return"}
        onClose={() => setDialog(null)}
        title="Registar devolução"
        description="Indique as unidades devolvidas. As danificadas entram automaticamente em manutenção."
      >
        {dialog === "return" && (
          <ActionForm action={registerReturnAction.bind(null, rentalId)} onSuccess={() => setDialog(null)} className="space-y-5">
            {({ errors: e, pending }) => (
              <>
                <Field label="Data da devolução" htmlFor="return-date" errors={e.date} required>
                  <Input id="return-date" name="date" type="date" defaultValue={today} max={today} />
                </Field>
                <div className="overflow-x-auto">
                  <table className="w-full text-[14px]">
                    <thead>
                      <tr className="text-left text-[12px] uppercase tracking-wide text-fg-muted">
                        <th className="pb-2 font-semibold">Artigo</th>
                        <th className="pb-2 text-right font-semibold">Devolvidas</th>
                        <th className="pb-2 text-right font-semibold">Danificadas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pendingItems.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 pr-3">
                            {item.name}
                            <div className="text-[12px] text-fg-subtle">
                              faltam {formatInteger(item.pending)} {item.unit}
                            </div>
                          </td>
                          <td className="py-2 pl-2">
                            <Input
                              aria-label={`Devolvidas — ${item.name}`}
                              type="number"
                              min={0}
                              max={item.pending}
                              className="ml-auto h-9 w-20 text-right"
                              value={lines[item.id]?.returned ?? "0"}
                              onChange={(ev) => setLines((l) => ({ ...l, [item.id]: { ...l[item.id]!, returned: ev.target.value } }))}
                            />
                          </td>
                          <td className="py-2 pl-2">
                            <Input
                              aria-label={`Danificadas — ${item.name}`}
                              type="number"
                              min={0}
                              className="ml-auto h-9 w-20 text-right"
                              value={lines[item.id]?.damaged ?? "0"}
                              onChange={(ev) => setLines((l) => ({ ...l, [item.id]: { ...l[item.id]!, damaged: ev.target.value } }))}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <input
                  type="hidden"
                  name="lines"
                  value={JSON.stringify(
                    Object.entries(lines).map(([rentalItemId, l]) => ({
                      rentalItemId,
                      returned: Number(l.returned) || 0,
                      damaged: Number(l.damaged) || 0,
                    })),
                  )}
                />
                <FieldError messages={e.lines} />
                <Field label="Notas" htmlFor="return-notes" errors={e.notes}>
                  <Input id="return-notes" name="notes" placeholder="Ex.: 2 cadeiras com riscos" />
                </Field>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={() => setDialog(null)}>
                    Voltar
                  </Button>
                  <Button type="submit" loading={pending}>
                    Registar devolução
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
