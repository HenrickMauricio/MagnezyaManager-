import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ArchiveRestore, FileText, Pencil, UserPlus } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { getClient } from "@/server/services/clients";
import { archiveClientAction, restoreClientAction } from "@/server/actions/clients";
import { orNotFound } from "@/server/page-helpers";
import { ContactsSection } from "@/components/features/clients/contacts-section";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/dialog";
import { DetailList, PageHeader } from "@/components/ui/page";
import { CLIENT_TYPES, COUNTRIES, type CountryCode } from "@/lib/validation/clients";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("client:view");
  const c = await orNotFound(getClient(user, id));

  const archived = c.archivedAt !== null;
  const canEdit = user.permissions.has("client:edit") && !archived;
  const canArchive = user.permissions.has("client:delete");
  const canManageUsers = user.permissions.has("user:manage");
  const address = [c.billingAddress, [c.postalCode, c.city].filter(Boolean).join(" ")].filter(Boolean).join("\n");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        back={{ href: "/clientes", label: "Clientes" }}
        eyebrow={
          <span className="inline-flex items-center gap-2">
            {CLIENT_TYPES[c.type]} · NIF {c.nif}
            {archived && <Badge tone="warning">Arquivado</Badge>}
          </span>
        }
        title={c.name}
        actions={
          <>
            {canEdit && (
              <Link href={`/clientes/${c.id}/editar`} className={buttonClasses({ variant: "secondary" })}>
                <Pencil className="size-4" /> Editar
              </Link>
            )}
            {canArchive &&
              (archived ? (
                <ConfirmButton
                  variant="secondary"
                  tone="primary"
                  title="Restaurar cliente?"
                  description="O cliente volta a aparecer na lista e pode voltar a ser usado em orçamentos. As contas do portal continuam desativadas até serem ativadas por um administrador."
                  confirmLabel="Restaurar"
                  action={restoreClientAction.bind(null, c.id)}
                >
                  <ArchiveRestore className="size-4" /> Restaurar
                </ConfirmButton>
              ) : (
                <ConfirmButton
                  variant="secondary"
                  title="Arquivar cliente?"
                  description={
                    <>
                      <strong className="text-fg">{c.name}</strong> deixa de aparecer na lista de clientes ativos. O histórico
                      mantém-se.
                      {c.portalUsers.some((u) => u.active) &&
                        " As contas do portal deste cliente serão desativadas e as sessões terminadas."}
                    </>
                  }
                  confirmLabel="Arquivar"
                  action={archiveClientAction.bind(null, c.id)}
                >
                  <Archive className="size-4" /> Arquivar
                </ConfirmButton>
              ))}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Dados do cliente" />
            <DetailList
              items={[
                { label: "Email", value: c.email },
                { label: "Telefone", value: c.phone },
                { label: "Morada de faturação", value: address || null, wide: true },
                { label: "País", value: COUNTRIES[c.country as CountryCode] ?? c.country },
                {
                  label: "Consentimento RGPD",
                  value: c.gdprConsentAt ? `Registado a ${formatDate(c.gdprConsentAt)}` : "Não registado",
                },
                { label: "Notas internas", value: c.notes, wide: true },
              ]}
            />
            <div className="border-t border-border px-5 py-3 text-[12px] text-fg-subtle">
              Criado a {formatDateTime(c.createdAt)}
              {c.createdBy && ` por ${c.createdBy.name}`} · Atualizado a {formatDateTime(c.updatedAt)}
            </div>
          </Card>

          <ContactsSection
            clientId={c.id}
            canEdit={canEdit}
            contacts={c.contacts.map(({ id, name, jobTitle, email, phone, isPrimary }) => ({
              id,
              name,
              jobTitle,
              email,
              phone,
              isPrimary,
            }))}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Acesso ao portal"
              description="Contas com que o cliente consulta e aprova propostas."
              action={
                canManageUsers &&
                !archived && (
                  <Link
                    href={`/utilizadores/novo?perfil=CLIENTE&cliente=${c.id}`}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    <UserPlus className="size-4" /> Criar
                  </Link>
                )
              }
            />
            {c.portalUsers.length === 0 ? (
              <p className="px-5 py-8 text-center text-[14px] text-fg-muted">Sem contas no portal.</p>
            ) : (
              <ul className="divide-y divide-border">
                {c.portalUsers.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      {canManageUsers ? (
                        <Link href={`/utilizadores/${u.id}`} className="font-medium hover:underline">
                          {u.name}
                        </Link>
                      ) : (
                        <span className="font-medium">{u.name}</span>
                      )}
                      <div className="truncate text-[13px] text-fg-muted">{u.email}</div>
                    </div>
                    <Badge tone={u.active ? "success" : "neutral"}>{u.active ? "Ativa" : "Inativa"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Orçamentos e alugueres" action={<Badge>Fase 5</Badge>} />
            <div className="flex flex-col items-center px-5 py-8 text-center text-[14px] text-fg-muted">
              <FileText className="mb-3 size-6 text-fg-subtle" strokeWidth={1.5} />
              O histórico de orçamentos deste cliente aparece aqui quando o módulo de orçamentos estiver ativo.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
