import type { Metadata } from "next";
import Link from "next/link";
import { Plus, UserCog } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { listUsers } from "@/server/services/users";
import { ListFilters } from "@/components/list-filters";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Pagination, RowLink, Table, Td, Th, listHref, rowClass } from "@/components/ui/table";
import { ROLE_KEYS, ROLE_LABELS, type RoleKey } from "@/lib/permissions";
import { userListSchema } from "@/lib/validation/users";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Utilizadores" };

const DEFAULTS = { q: "", perfil: "todos", estado: "ativos", pagina: 1 };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requirePagePermission("user:manage");
  const params = userListSchema.parse(await searchParams);
  const { items, total, page, pageSize } = await listUsers(actor, params);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Utilizadores"
        description="Equipa interna e contas do portal dos clientes."
        actions={
          <Link href="/utilizadores/novo" className={buttonClasses()}>
            <Plus className="size-4" /> Novo utilizador
          </Link>
        }
      />

      <ListFilters
        placeholder="Pesquisar por nome ou email"
        filters={[
          {
            name: "perfil",
            label: "Perfil",
            defaultValue: "todos",
            options: [
              { value: "todos", label: "Todos os perfis" },
              ...ROLE_KEYS.map((k) => ({ value: k, label: ROLE_LABELS[k] })),
            ],
          },
          {
            name: "estado",
            label: "Estado",
            defaultValue: "ativos",
            options: [
              { value: "ativos", label: "Ativos" },
              { value: "inativos", label: "Inativos" },
              { value: "todos", label: "Todos" },
            ],
          },
        ]}
      />

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={<UserCog className="size-8" strokeWidth={1.5} />}
            title="Nenhum utilizador encontrado"
            description="Experimente outra pesquisa ou outro filtro."
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Nome</Th>
                  <Th>Perfil</Th>
                  <Th>Estado</Th>
                  <Th>Último acesso</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className={rowClass}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <RowLink href={`/utilizadores/${u.id}`}>{u.name}</RowLink>
                        {u.id === actor.id && <Badge>Você</Badge>}
                      </div>
                      <div className="text-[12px] text-fg-subtle">{u.email}</div>
                    </Td>
                    <Td className="text-fg-muted">
                      {ROLE_LABELS[u.role.key as RoleKey]}
                      {u.client && <div className="text-[12px] text-fg-subtle">{u.client.name}</div>}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={u.active ? "success" : "neutral"}>{u.active ? "Ativo" : "Inativo"}</Badge>
                        {u.mustChangePassword && u.active && <Badge tone="warning">Palavra-passe temporária</Badge>}
                      </div>
                    </Td>
                    <Td className="tabular text-fg-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Nunca"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              hrefFor={(p) => listHref("/utilizadores", { ...params, pagina: p }, DEFAULTS)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
