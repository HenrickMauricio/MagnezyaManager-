import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { listTaxRateOptions } from "@/server/services/articles";
import { getCompanySettings, listServices } from "@/server/services/settings";
import { CompanyForm } from "@/components/features/settings/company-form";
import { LogoCard } from "@/components/features/settings/logo-card";
import { ServicesManager } from "@/components/features/settings/services-manager";
import { PageHeader } from "@/components/ui/page";
import { formatBasisPoints } from "@/lib/format";

export const metadata: Metadata = { title: "Definições" };

const REGION_LABELS: Record<string, string> = { CONTINENTE: "Continente", ACORES: "Açores", MADEIRA: "Madeira" };

export default async function SettingsPage() {
  const user = await requirePagePermission("settings:manage");
  const [company, services, taxRates] = await Promise.all([
    getCompanySettings(),
    listServices(user),
    listTaxRateOptions(user),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Definições" description="Dados da empresa, propostas e serviços adicionais." />
      <LogoCard logoKey={company.logoKey} brandName={company.tradeName} />
      <CompanyForm
        initial={{
          legalName: company.legalName,
          tradeName: company.tradeName,
          nif: company.nif ?? "",
          address: company.address ?? "",
          postalCode: company.postalCode ?? "",
          city: company.city ?? "",
          phone: company.phone ?? "",
          email: company.email ?? "",
          website: company.website ?? "",
          iban: company.iban ?? "",
          quotePrefix: company.quotePrefix,
          quoteValidityDays: company.quoteValidityDays,
          defaultTerms: company.defaultTerms ?? "",
        }}
      />
      <ServicesManager
        taxRates={taxRates.map((t) => ({
          id: t.id,
          label: `${t.name} ${formatBasisPoints(t.rateBp)} · ${REGION_LABELS[t.region] ?? t.region}`,
        }))}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          unit: s.unit,
          defaultPriceCents: s.defaultPriceCents,
          taxRateId: s.taxRate.id,
          taxRateBp: s.taxRate.rateBp,
          active: s.active,
        }))}
      />
    </div>
  );
}
