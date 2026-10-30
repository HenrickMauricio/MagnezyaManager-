import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { createArticleAction } from "@/server/actions/catalog";
import { listTaxRateOptions } from "@/server/services/articles";
import { listCategoryOptions } from "@/server/services/categories";
import { ArticleForm } from "@/components/features/catalog/article-form";
import { PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Novo artigo" };

export default async function NewArticlePage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const user = await requirePagePermission("article:write");
  const [categories, taxRates, { categoria }] = await Promise.all([
    listCategoryOptions(user),
    listTaxRateOptions(user),
    searchParams,
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Novo artigo" back={{ href: "/artigos", label: "Artigos" }} />
      <ArticleForm
        mode="create"
        action={createArticleAction}
        categories={categories}
        taxRates={taxRates}
        cancelHref="/artigos"
        initial={{
          name: "",
          sku: "",
          categoryId: categories.find((c) => c.slug === categoria)?.id ?? "",
          description: "",
          unit: "un",
          price: "",
          priceUnit: "POR_DIA",
          taxRateId: taxRates.find((t) => t.isDefault)?.id ?? taxRates[0]?.id ?? "",
          status: "ATIVO",
          internalNotes: "",
          stockBase: "0",
        }}
      />
    </div>
  );
}
