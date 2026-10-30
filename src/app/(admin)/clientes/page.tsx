import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { listClients } from "@/server/services/clients";
import { ListFilters } from "@/components/list-filters";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Pagination, RowLink, Table, Td, Th, listHref, rowClass } from "@/components/ui/table";
import { CLIENT_TYPES, clientListSchema } from "@/lib/validation/clients";

export const metadata: Metadata = { title: "Clientes" };

const DEFAULTS = { q: "", estado: "ativos", ordem: "nome", pagina: 1 };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePagePermission("client:view");
  const params = clientListSchema.parse(await searchParams);
  const { items, total, page, pageSize } = await listClients(user, params);
  const canCreate = user.permissions.has("client:create");
  const filtered = params.q !== "" || params.estado !== "ativos";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Clientes"
        description="Empresas e particulares a quem a Magnezya aluga material."
        actions={
          canCreate && (
            <Link href="/clientes/novo" className={buttonClasses()}>
              <Plus className="size-4" /> Novo cliente
            </Link>
          )
        }
      />

      <ListFilters
        placeholder="Pesquisar por nome, NIF, email ou localidade"
        filters={[
          {
            name: "estado",
            label: "Estado",
            defaultValue: "ativos",
            options: [
              { value: "ativos", label: "Ativos" },
              { value: "arquivados", label: "Arquivados" },
            ],
          },
          {
            name: "ordem",
            label: "Ordenar",
            defaultValue: "nome",
            options: [
              { value: "nome", label: "Nome (A–Z)" },
              { value: "cidade", label: "Localidade" },
              { value: "recentes", label: "Mais recentes" },
            ],
          },
        ]}
      />

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8" strokeWidth={1.5} />}
            title={filtered ? "Nenhum cliente encontrado" : "Ainda não há clientes"}
            description={filtered ? "Experimente outra pesquisa ou outro filtro." : "Crie o primeiro cliente para começar."}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Cliente</Th>
                  <Th>NIF</Th>
                  <Th>Contacto principal</Th>
                  <Th>Email / telefone</Th>
                  <Th>Localidade</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className={rowClass}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <RowLink href={`/clientes/${c.id}`}>{c.name}</RowLink>
                        {c.archivedAt && <Badge>Arquivado</Badge>}
                      </div>
                      <div className="text-[12px] text-fg-subtle">{CLIENT_TYPES[c.type]}</div>
                    </Td>
                    <Td className="tabular text-fg-muted">{c.nif}</Td>
                    <Td className="text-fg-muted">{c.contacts[0]?.name ?? "—"}</Td>
                    <Td className="text-fg-muted">
                      <div className="max-w-[240px] truncate">{c.email ?? "—"}</div>
                      {c.phone && <div className="text-[12px] text-fg-subtle">{c.phone}</div>}
                    </Td>
                    <Td className="text-fg-muted">{c.city ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              hrefFor={(p) => listHref("/clientes", { ...params, pagina: p }, DEFAULTS)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
