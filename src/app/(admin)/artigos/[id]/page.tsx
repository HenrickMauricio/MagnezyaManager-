import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { MAX_IMAGES_PER_ARTICLE, getArticle } from "@/server/services/articles";
import { listArticleMaintenances, listArticleMovements } from "@/server/services/inventory";
import { archiveArticleAction, restoreArticleAction } from "@/server/actions/catalog";
import { orNotFound } from "@/server/page-helpers";
import { ArticleImages } from "@/components/features/catalog/article-images";
import { MaintenanceCard, MovementsCard } from "@/components/features/catalog/stock-history";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/dialog";
import { DetailList, PageHeader } from "@/components/ui/page";
import { dateOnlyToISO, formatBasisPoints, formatCents, formatDateTime, formatInteger, todayISO } from "@/lib/format";
import { ARTICLE_STATUSES, PRICE_UNITS } from "@/lib/validation/catalog";

export const metadata: Metadata = { title: "Artigo" };

const STATUS_TONE = { ATIVO: "success", INATIVO: "neutral", DESCONTINUADO: "warning" } as const;
const REGION_LABELS: Record<string, string> = { CONTINENTE: "Continente", ACORES: "Açores", MADEIRA: "Madeira" };

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("article:view");
  const [a, movements, maintenances] = await Promise.all([
    orNotFound(getArticle(user, id)),
    listArticleMovements(user, id),
    listArticleMaintenances(user, id),
  ]);

  const archived = a.archivedAt !== null;
  const canWrite = user.permissions.has("article:write") && !archived;
  const canArchive = user.permissions.has("article:delete");
  const canManageStock = user.permissions.has("inventory:manage") && !archived;
  const today = todayISO();
  const free = a.stock.total - a.stock.inMaintenance;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        back={{ href: "/artigos", label: "Artigos" }}
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="tabular">{a.sku}</span> ·{" "}
            <Link href={`/artigos?categoria=${a.category.slug}`} className="hover:text-fg hover:underline">
              {a.category.name}
            </Link>
            {archived ? <Badge tone="warning">Arquivado</Badge> : <Badge tone={STATUS_TONE[a.status]}>{ARTICLE_STATUSES[a.status]}</Badge>}
          </span>
        }
        title={a.name}
        actions={
          <>
            {canWrite && (
              <Link href={`/artigos/${a.id}/editar`} className={buttonClasses({ variant: "secondary" })}>
                <Pencil className="size-4" /> Editar
              </Link>
            )}
            {canArchive &&
              (archived ? (
                <ConfirmButton
                  variant="secondary"
                  tone="primary"
                  title="Restaurar artigo?"
                  description="O artigo volta ao catálogo com o estado que tinha."
                  confirmLabel="Restaurar"
                  action={restoreArticleAction.bind(null, a.id)}
                >
                  <ArchiveRestore className="size-4" /> Restaurar
                </ConfirmButton>
              ) : (
                <ConfirmButton
                  variant="secondary"
                  title="Arquivar artigo?"
                  description={`"${a.name}" sai do catálogo e deixa de poder ser usado em novos orçamentos. O histórico mantém-se.`}
                  confirmLabel="Arquivar"
                  action={archiveArticleAction.bind(null, a.id)}
                >
                  <Archive className="size-4" /> Arquivar
                </ConfirmButton>
              ))}
          </>
        }
      />

      <section aria-label="Stock" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Stock total"
          value={`${formatInteger(a.stock.total)} ${a.unit}`}
          hint={`Stock inicial ${formatInteger(a.stockBase)} ${a.unit}, mais movimentos`}
        />
        <StatCard label="Em manutenção" value={`${formatInteger(a.stock.inMaintenance)} ${a.unit}`} />
        <StatCard
          label="Disponível hoje"
          value={`${formatInteger(free)} ${a.unit}`}
          hint="Antes de reservas — o motor de disponibilidade entra na fase 4"
        />
      </section>

      <Card>
        <CardHeader title="Dados do artigo" />
        <DetailList
          className="sm:grid-cols-3"
          items={[
            { label: "Preço", value: `${formatCents(a.priceCents)} ${PRICE_UNITS[a.priceUnit].toLowerCase()}` },
            {
              label: "IVA",
              value: `${a.taxRate.name} ${formatBasisPoints(a.taxRate.rateBp)} · ${REGION_LABELS[a.taxRate.region] ?? a.taxRate.region}`,
            },
            { label: "Unidade", value: a.unit },
            {
              label: "Preparação após recolha",
              value:
                a.category.prepBufferDays === 0
                  ? "Sem dias de preparação"
                  : `${a.category.prepBufferDays} ${a.category.prepBufferDays === 1 ? "dia" : "dias"} (definido na categoria)`,
            },
            { label: "Descrição", value: a.description, wide: true },
            { label: "Notas internas", value: a.internalNotes, wide: true },
          ]}
        />
        <div className="border-t border-border px-5 py-3 text-[12px] text-fg-subtle">
          Criado a {formatDateTime(a.createdAt)} · Atualizado a {formatDateTime(a.updatedAt)}
        </div>
      </Card>

      <ArticleImages
        articleId={a.id}
        canEdit={canWrite}
        maxImages={MAX_IMAGES_PER_ARTICLE}
        images={a.images.map(({ id, storageKey, alt, isPrimary }) => ({ id, storageKey, alt, isPrimary }))}
      />

      <div className="space-y-6">
        <MovementsCard
          articleId={a.id}
          unit={a.unit}
          canManage={canManageStock}
          today={today}
          movements={movements.map((m) => ({
            id: m.id,
            type: m.type,
            quantity: m.quantity,
            date: dateOnlyToISO(m.effectiveDate),
            reason: m.reason,
            userName: m.user?.name ?? null,
          }))}
        />
        <MaintenanceCard
          articleId={a.id}
          unit={a.unit}
          canManage={canManageStock}
          today={today}
          maintenances={maintenances.map((m) => ({
            id: m.id,
            quantity: m.quantity,
            status: m.status,
            startDate: dateOnlyToISO(m.startDate),
            expectedEndDate: m.expectedEndDate ? dateOnlyToISO(m.expectedEndDate) : null,
            endDate: m.endDate ? dateOnlyToISO(m.endDate) : null,
            reason: m.reason,
            costCents: m.costCents,
            userName: m.user?.name ?? null,
          }))}
        />
      </div>
    </div>
  );
}
