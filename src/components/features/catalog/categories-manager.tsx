"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, FolderTree, Pencil, Plus } from "lucide-react";
import {
  archiveCategoryAction,
  moveCategoryAction,
  restoreCategoryAction,
  saveCategoryAction,
} from "@/server/actions/catalog";
import { ActionButton } from "@/components/action-button";
import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmButton, Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/page";
import { formatInteger } from "@/lib/format";

export type CategoryView = {
  id: string;
  name: string;
  slug: string;
  skuPrefix: string;
  description: string | null;
  prepBufferDays: number;
  articleCount: number;
};

export function CategoriesManager({ active, archived }: { active: CategoryView[]; archived: CategoryView[] }) {
  const [editing, setEditing] = useState<CategoryView | "new" | null>(null);
  const current = editing === "new" ? null : editing;

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Nova categoria
        </Button>
      </div>

      <Card>
        <CardHeader
          title="Categorias ativas"
          description="A ordem definida aqui é usada nas listas e no catálogo."
        />
        {active.length === 0 ? (
          <EmptyState
            icon={<FolderTree className="size-8" strokeWidth={1.5} />}
            title="Sem categorias"
            description="Crie a primeira categoria para começar a registar artigos."
          />
        ) : (
          <ul className="divide-y divide-border">
            {active.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <div className="flex shrink-0 flex-col">
                  <ActionButton
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5"
                    disabled={i === 0}
                    aria-label={`Subir ${c.name}`}
                    action={moveCategoryAction.bind(null, c.id, "up")}
                  >
                    <ArrowUp className="size-3.5" />
                  </ActionButton>
                  <ActionButton
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5"
                    disabled={i === active.length - 1}
                    aria-label={`Descer ${c.name}`}
                    action={moveCategoryAction.bind(null, c.id, "down")}
                  >
                    <ArrowDown className="size-3.5" />
                  </ActionButton>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/artigos?categoria=${c.slug}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <Badge>{c.skuPrefix}</Badge>
                  </div>
                  <div className="mt-0.5 text-[13px] text-fg-muted">
                    {formatInteger(c.articleCount)} {c.articleCount === 1 ? "artigo" : "artigos"}
                    {" · "}
                    {c.prepBufferDays === 0
                      ? "sem dias de preparação"
                      : `${c.prepBufferDays} ${c.prepBufferDays === 1 ? "dia" : "dias"} de preparação após recolha`}
                    {c.description && ` · ${c.description}`}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)} aria-label={`Editar ${c.name}`}>
                    <Pencil className="size-4" />
                  </Button>
                  <ConfirmButton
                    size="sm"
                    variant="ghost"
                    aria-label={`Arquivar ${c.name}`}
                    title="Arquivar categoria?"
                    description={
                      c.articleCount > 0
                        ? `"${c.name}" ainda tem artigos. Mova-os para outra categoria ou arquive-os primeiro.`
                        : `"${c.name}" deixa de aparecer nas listas. Pode restaurá-la mais tarde.`
                    }
                    confirmLabel="Arquivar"
                    action={archiveCategoryAction.bind(null, c.id)}
                  >
                    <Archive className="size-4" />
                  </ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {archived.length > 0 && (
        <Card>
          <CardHeader title="Categorias arquivadas" />
          <ul className="divide-y divide-border">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="flex items-center gap-2 text-fg-muted">
                  {c.name} <Badge>{c.skuPrefix}</Badge>
                </div>
                <ConfirmButton
                  size="sm"
                  variant="secondary"
                  tone="primary"
                  title="Restaurar categoria?"
                  description={`"${c.name}" volta a estar disponível para novos artigos.`}
                  confirmLabel="Restaurar"
                  action={restoreCategoryAction.bind(null, c.id)}
                >
                  <ArchiveRestore className="size-4" /> Restaurar
                </ConfirmButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={current ? "Editar categoria" : "Nova categoria"}
      >
        {editing !== null && (
          <ActionForm
            action={saveCategoryAction.bind(null, current?.id ?? null)}
            onSuccess={() => setEditing(null)}
            className="space-y-5"
          >
            {({ errors: e, pending }) => (
              <>
                <Field label="Nome" htmlFor="cat-name" errors={e.name} required>
                  <Input id="cat-name" name="name" defaultValue={current?.name} invalid={!!e.name} autoFocus />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Prefixo do SKU"
                    htmlFor="cat-prefix"
                    errors={e.skuPrefix}
                    required
                    hint="2 a 6 letras. Novos artigos: CAD-0001, CAD-0002…"
                  >
                    <Input
                      id="cat-prefix"
                      name="skuPrefix"
                      defaultValue={current?.skuPrefix}
                      invalid={!!e.skuPrefix}
                      maxLength={6}
                      className="uppercase"
                    />
                  </Field>
                  <Field
                    label="Dias de preparação"
                    htmlFor="cat-buffer"
                    errors={e.prepBufferDays}
                    required
                    hint="Dias após a recolha em que o artigo continua ocupado (limpeza, verificação)."
                  >
                    <Input
                      id="cat-buffer"
                      name="prepBufferDays"
                      type="number"
                      min={0}
                      max={30}
                      defaultValue={current?.prepBufferDays ?? 0}
                      invalid={!!e.prepBufferDays}
                    />
                  </Field>
                </div>
                <Field label="Descrição" htmlFor="cat-description" errors={e.description}>
                  <Textarea id="cat-description" name="description" defaultValue={current?.description ?? ""} rows={2} />
                </Field>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" loading={pending}>
                    {current ? "Guardar" : "Criar categoria"}
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
