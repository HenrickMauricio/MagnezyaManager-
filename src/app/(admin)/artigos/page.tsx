import type { Metadata } from "next";
import Link from "next/link";
import { ImageIcon, Package, Plus } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { listArticles } from "@/server/services/articles";
import { listCategoryOptions } from "@/server/services/categories";
import { ListFilters } from "@/components/list-filters";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Pagination, RowLink, Table, Td, Th, listHref, rowClass } from "@/components/ui/table";
import { fileUrl } from "@/lib/files";
import { formatCents, formatInteger } from "@/lib/format";
import { ARTICLE_STATUSES, PRICE_UNITS, articleListSchema } from "@/lib/validation/catalog";

export const metadata: Metadata = { title: "Artigos" };

const DEFAULTS = { q: "", categoria: "", estado: "ativos", ordem: "nome", pagina: 1 };
const STATUS_TONE = { ATIVO: "success", INATIVO: "neutral", DESCONTINUADO: "warning" } as const;

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePagePermission("article:view");
  const params = articleListSchema.parse(await searchParams);
  const [{ items, total, page, pageSize }, categories] = await Promise.all([
    listArticles(user, params),
    listCategoryOptions(user),
  ]);
  const canCreate = user.permissions.has("article:write");
  const filtered = params.q !== "" || params.categoria !== "" || params.estado !== "ativos";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Artigos"
        description="Catálogo de mobiliário e equipamento para aluguer."
        actions={
          canCreate && (
            <Link href="/artigos/novo" className={buttonClasses()}>
              <Plus className="size-4" /> Novo artigo
            </Link>
          )
        }
      />

      <ListFilters
        placeholder="Pesquisar por nome, SKU ou descrição"
        filters={[
          {
            name: "categoria",
            label: "Categoria",
            defaultValue: "",
            options: [{ value: "", label: "Todas as categorias" }, ...categories.map((c) => ({ value: c.slug, label: c.name }))],
          },
          {
            name: "estado",
            label: "Estado",
            defaultValue: "ativos",
            options: [
              { value: "ativos", label: "Ativos" },
              { value: "inativos", label: "Inativos" },
              { value: "descontinuados", label: "Descontinuados" },
              { value: "todos", label: "Todos (não arquivados)" },
              { value: "arquivados", label: "Arquivados" },
            ],
          },
          {
            name: "ordem",
            label: "Ordenar",
            defaultValue: "nome",
            options: [
              { value: "nome", label: "Nome (A–Z)" },
              { value: "sku", label: "SKU" },
              { value: "preco", label: "Preço (maior primeiro)" },
              { value: "recentes", label: "Mais recentes" },
            ],
          },
        ]}
      />

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={<Package className="size-8" strokeWidth={1.5} />}
            title={filtered ? "Nenhum artigo encontrado" : "Ainda não há artigos"}
            description={filtered ? "Experimente outra pesquisa ou outro filtro." : "Crie o primeiro artigo do catálogo."}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Artigo</Th>
                  <Th>Categoria</Th>
                  <Th className="text-right">Preço</Th>
                  <Th className="text-right">Stock</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => {
                  const image = a.images[0];
                  return (
                    <tr key={a.id} className={rowClass}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-surface-2">
                            {image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={fileUrl(image.storageKey, "thumb")} alt="" className="size-full object-cover" loading="lazy" />
                            ) : (
                              <ImageIcon className="absolute inset-0 m-auto size-4 text-fg-subtle" strokeWidth={1.5} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <RowLink href={`/artigos/${a.id}`}>{a.name}</RowLink>
                            <div className="tabular text-[12px] text-fg-subtle">{a.sku}</div>
                          </div>
                        </div>
                      </Td>
                      <Td className="text-fg-muted">{a.category.name}</Td>
                      <Td className="tabular whitespace-nowrap text-right">
                        {formatCents(a.priceCents)}
                        <div className="text-[12px] text-fg-subtle">{PRICE_UNITS[a.priceUnit].toLowerCase()}</div>
                      </Td>
                      <Td className="tabular whitespace-nowrap text-right">
                        {formatInteger(a.stock.total)} <span className="text-fg-subtle">{a.unit}</span>
                        {a.stock.inMaintenance > 0 && (
                          <div className="text-[12px] text-warning">{formatInteger(a.stock.inMaintenance)} em manutenção</div>
                        )}
                      </Td>
                      <Td>
                        {a.archivedAt ? <Badge>Arquivado</Badge> : <Badge tone={STATUS_TONE[a.status]}>{ARTICLE_STATUSES[a.status]}</Badge>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              hrefFor={(p) => listHref("/artigos", { ...params, pagina: p }, DEFAULTS)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
