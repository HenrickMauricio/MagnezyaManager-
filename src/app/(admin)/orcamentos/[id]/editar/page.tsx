import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { getBuilderOptions, getQuote } from "@/server/services/quotes";
import { orNotFound } from "@/server/page-helpers";
import { QuoteBuilder } from "@/components/features/quotes/quote-builder";
import { PageHeader } from "@/components/ui/page";
import { canEditQuote } from "@/lib/permissions";
import { dateOnlyToISO } from "@/lib/format";
import { EDITABLE_STATUSES, type QuoteStatus } from "@/lib/validation/quotes";

export const metadata: Metadata = { title: "Editar orçamento" };

const pct = (bp: number) => (bp ? String(bp / 100).replace(".", ",") : "");

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("quote:view");
  const [q, options] = await Promise.all([orNotFound(getQuote(user, id)), getBuilderOptions(user)]);
  if (!canEditQuote(user, q) || !EDITABLE_STATUSES.includes(q.status as QuoteStatus)) redirect(`/orcamentos/${id}`);

  // Artigos que já estão no orçamento continuam escolhíveis, mesmo que tenham sido desativados.
  const extra = q.items
    .filter((i) => !options.articles.some((a) => a.id === i.articleId))
    .map((i) => ({
      id: i.articleId,
      sku: i.skuSnapshot,
      name: i.nameSnapshot,
      unit: i.article.unit,
      priceCents: i.unitPriceCents,
      priceUnit: i.priceUnit,
      taxRate: { rateBp: i.taxRateBp },
    }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={`Editar ${q.number}`}
        description={
          q.status === "ENVIADO" || q.status === "EXPIRADO"
            ? `Ao gravar, o orçamento volta a rascunho; a próxima emissão cria a versão ${q.currentVersion + 1}. As versões emitidas não mudam.`
            : undefined
        }
        back={{ href: `/orcamentos/${id}`, label: q.number }}
      />
      <QuoteBuilder
        quoteId={id}
        clients={options.clients}
        articles={[...options.articles, ...extra].map((a) => ({ ...a, taxRateBp: a.taxRate.rateBp }))}
        catalogServices={options.services.map((s) => ({ ...s, taxRateBp: s.taxRate.rateBp }))}
        fallbackTaxBp={options.fallbackTaxBp}
        cancelHref={`/orcamentos/${id}`}
        initial={{
          clientId: q.client.id,
          eventName: q.event.name,
          venue: q.event.venue ?? "",
          city: q.event.city ?? "",
          deliveryDate: dateOnlyToISO(q.deliveryDate),
          startDate: dateOnlyToISO(q.startDate),
          endDate: dateOnlyToISO(q.endDate),
          returnDate: dateOnlyToISO(q.returnDate),
          validUntil: dateOnlyToISO(q.validUntil),
          discount: pct(q.discountBp),
          notes: q.notes ?? "",
          internalNotes: q.internalNotes ?? "",
          terms: q.terms ?? "",
          lockVersion: q.lockVersion,
          items: q.items.map((i) => ({
            articleId: i.articleId,
            quantity: String(i.quantity),
            discount: pct(i.discountBp),
            unitPriceCents: i.unitPriceCents,
            priceUnit: i.priceUnit,
          })),
          services: q.services.map((s) => ({
            serviceId: s.serviceId,
            description: s.description,
            quantity: String(s.quantity),
            price: (s.unitPriceCents / 100).toFixed(2).replace(".", ","),
          })),
        }}
      />
    </div>
  );
}
