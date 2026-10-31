import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { getBuilderOptions } from "@/server/services/quotes";
import { QuoteBuilder } from "@/components/features/quotes/quote-builder";
import { PageHeader } from "@/components/ui/page";
import { addDaysISO, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Novo orçamento" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const user = await requirePagePermission("quote:create");
  const [{ clients, articles, services, settings, fallbackTaxBp }, { cliente }] = await Promise.all([
    getBuilderOptions(user),
    searchParams,
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Novo orçamento" back={{ href: "/orcamentos", label: "Orçamentos" }} />
      <QuoteBuilder
        quoteId={null}
        clients={clients}
        articles={articles.map((a) => ({ ...a, taxRateBp: a.taxRate.rateBp }))}
        catalogServices={services.map((s) => ({ ...s, taxRateBp: s.taxRate.rateBp }))}
        fallbackTaxBp={fallbackTaxBp}
        cancelHref="/orcamentos"
        initial={{
          clientId: clients.some((c) => c.id === cliente) ? cliente! : "",
          eventName: "",
          venue: "",
          city: "",
          deliveryDate: "",
          startDate: "",
          endDate: "",
          returnDate: "",
          validUntil: addDaysISO(todayISO(), settings.quoteValidityDays),
          discount: "",
          notes: "",
          internalNotes: "",
          terms: settings.defaultTerms ?? "",
          items: [],
          services: [],
        }}
      />
    </div>
  );
}
