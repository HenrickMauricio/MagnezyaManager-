import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { listCategories } from "@/server/services/categories";
import { CategoriesManager, type CategoryView } from "@/components/features/catalog/categories-manager";
import { PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriesPage() {
  const user = await requirePagePermission("category:manage");
  const { active, archived } = await listCategories(user);
  const view = (c: (typeof active)[number]): CategoryView => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    skuPrefix: c.skuPrefix,
    description: c.description,
    prepBufferDays: c.prepBufferDays,
    articleCount: c._count.articles,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Categorias" description="Organização do catálogo e regras comuns aos artigos de cada categoria." />
      <CategoriesManager active={active.map(view)} archived={archived.map(view)} />
    </div>
  );
}
