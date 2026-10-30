import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { updateArticleAction } from "@/server/actions/catalog";
import { getArticle, listTaxRateOptions } from "@/server/services/articles";
import { listCategoryOptions } from "@/server/services/categories";
import { orNotFound } from "@/server/page-helpers";
import { ArticleForm } from "@/components/features/catalog/article-form";
import { PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Editar artigo" };

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("article:write");
  const [a, categories, taxRates] = await Promise.all([
    orNotFound(getArticle(user, id)),
    listCategoryOptions(user),
    listTaxRateOptions(user),
  ]);
  if (a.archivedAt) redirect(`/artigos/${id}`);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Editar artigo" eyebrow={`${a.sku} · ${a.name}`} back={{ href: `/artigos/${id}`, label: "Ficha do artigo" }} />
      <ArticleForm
        mode="edit"
        action={updateArticleAction.bind(null, id)}
        categories={categories}
        taxRates={taxRates}
        cancelHref={`/artigos/${id}`}
        initial={{
          name: a.name,
          sku: a.sku,
          categoryId: a.categoryId,
          description: a.description ?? "",
          unit: a.unit,
          price: (a.priceCents / 100).toFixed(2).replace(".", ","),
          priceUnit: a.priceUnit,
          taxRateId: a.taxRateId,
          status: a.status,
          internalNotes: a.internalNotes ?? "",
          stockBase: String(a.stockBase),
        }}
      />
    </div>
  );
}
