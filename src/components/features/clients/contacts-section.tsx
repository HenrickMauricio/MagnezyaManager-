"use client";

import { useState } from "react";
import { Mail, Pencil, Phone, Plus, Star, Trash2, UserRound } from "lucide-react";
import { deleteContactAction, saveContactAction } from "@/server/actions/clients";
import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmButton, Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/page";
import { BRAND } from "@/config/brand";

export type ContactView = {
  id: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
};

export function ContactsSection({
  clientId,
  contacts,
  canEdit,
}: {
  clientId: string;
  contacts: ContactView[];
  canEdit: boolean;
}) {
  // null = fechado; "new" = novo contacto; ContactView = editar.
  const [editing, setEditing] = useState<ContactView | "new" | null>(null);
  const current = editing === "new" ? null : editing;

  return (
    <Card>
      <CardHeader
        title="Contactos"
        description={`Pessoas com quem a ${BRAND.name} fala neste cliente.`}
        action={
          canEdit && (
            <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Adicionar
            </Button>
          )
        }
      />
      {contacts.length === 0 ? (
        <EmptyState
          icon={<UserRound className="size-8" strokeWidth={1.5} />}
          title="Sem contactos"
          description="Adicione a pessoa de contacto principal deste cliente."
        />
      ) : (
        <ul className="divide-y divide-border">
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {c.isPrimary && (
                    <Badge tone="solid">
                      <Star className="size-3" fill="currentColor" /> Principal
                    </Badge>
                  )}
                </div>
                {c.jobTitle && <div className="text-[13px] text-fg-muted">{c.jobTitle}</div>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-fg-muted">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 hover:text-fg">
                      <Mail className="size-3.5" /> {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-fg">
                      <Phone className="size-3.5" /> {c.phone}
                    </a>
                  )}
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)} aria-label={`Editar ${c.name}`}>
                    <Pencil className="size-4" />
                  </Button>
                  <ConfirmButton
                    size="sm"
                    variant="ghost"
                    aria-label={`Eliminar ${c.name}`}
                    title="Eliminar contacto?"
                    description={`"${c.name}" será removido deste cliente. Esta ação não pode ser anulada.`}
                    confirmLabel="Eliminar"
                    action={deleteContactAction.bind(null, clientId, c.id)}
                  >
                    <Trash2 className="size-4" />
                  </ConfirmButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={current ? "Editar contacto" : "Novo contacto"}
      >
        {editing !== null && (
          <ActionForm
            action={saveContactAction.bind(null, clientId, current?.id ?? null)}
            onSuccess={() => setEditing(null)}
            className="space-y-5"
          >
            {({ errors: e, pending }) => (
              <>
                <Field label="Nome" htmlFor="contact-name" errors={e.name} required>
                  <Input id="contact-name" name="name" defaultValue={current?.name} invalid={!!e.name} autoFocus />
                </Field>
                <Field label="Cargo" htmlFor="contact-jobTitle" errors={e.jobTitle}>
                  <Input id="contact-jobTitle" name="jobTitle" defaultValue={current?.jobTitle ?? ""} />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Email" htmlFor="contact-email" errors={e.email}>
                    <Input id="contact-email" name="email" type="email" defaultValue={current?.email ?? ""} invalid={!!e.email} />
                  </Field>
                  <Field label="Telefone" htmlFor="contact-phone" errors={e.phone}>
                    <Input id="contact-phone" name="phone" type="tel" defaultValue={current?.phone ?? ""} invalid={!!e.phone} />
                  </Field>
                </div>
                {!current?.isPrimary && (
                  <Checkbox name="isPrimary" label="Contacto principal" defaultChecked={contacts.length === 0} />
                )}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" loading={pending}>
                    {current ? "Guardar" : "Adicionar"}
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
