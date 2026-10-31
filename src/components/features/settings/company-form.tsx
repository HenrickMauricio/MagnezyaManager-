"use client";

import { updateCompanySettingsAction } from "@/server/actions/settings";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";

export type CompanyValues = {
  legalName: string;
  tradeName: string;
  nif: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  iban: string;
  quotePrefix: string;
  quoteValidityDays: number;
  defaultTerms: string;
};

export function CompanyForm({ initial }: { initial: CompanyValues }) {
  return (
    <ActionForm action={updateCompanySettingsAction}>
      {({ errors: e, pending }) => {
        const input = (name: keyof CompanyValues) => ({
          id: name,
          name,
          invalid: !!e[name],
          "aria-describedby": `${name}-error`,
          defaultValue: String(initial[name] ?? ""),
        });
        return (
          <>
            <Card>
              <CardHeader title="Empresa" description="Aparece no cabeçalho e no rodapé das propostas em PDF." />
              <div className="grid gap-5 p-5 sm:grid-cols-2">
                <Field label="Denominação legal" htmlFor="legalName" errors={e.legalName} required>
                  <Input {...input("legalName")} placeholder="Ex.: Magnezya – Event Support, Lda." />
                </Field>
                <Field label="Nome comercial" htmlFor="tradeName" errors={e.tradeName} required>
                  <Input {...input("tradeName")} />
                </Field>
                <Field label="NIF" htmlFor="nif" errors={e.nif}>
                  <Input {...input("nif")} />
                </Field>
                <Field label="IBAN" htmlFor="iban" errors={e.iban} hint="Para pagamentos por transferência.">
                  <Input {...input("iban")} className="font-mono" />
                </Field>
                <Field label="Morada" htmlFor="address" errors={e.address} className="sm:col-span-2">
                  <Input {...input("address")} />
                </Field>
                <Field label="Código postal" htmlFor="postalCode" errors={e.postalCode}>
                  <Input {...input("postalCode")} placeholder="0000-000" />
                </Field>
                <Field label="Localidade" htmlFor="city" errors={e.city}>
                  <Input {...input("city")} />
                </Field>
                <Field label="Telefone" htmlFor="phone" errors={e.phone}>
                  <Input {...input("phone")} type="tel" />
                </Field>
                <Field label="Email" htmlFor="email" errors={e.email}>
                  <Input {...input("email")} type="email" />
                </Field>
                <Field label="Website" htmlFor="website" errors={e.website} className="sm:col-span-2">
                  <Input {...input("website")} />
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader title="Propostas" />
              <div className="grid gap-5 p-5 sm:grid-cols-2">
                <Field label="Prefixo da numeração" htmlFor="quotePrefix" errors={e.quotePrefix} required hint="Ex.: ORC → ORC-2026-0001">
                  <Input {...input("quotePrefix")} className="uppercase" maxLength={6} />
                </Field>
                <Field label="Validade (dias)" htmlFor="quoteValidityDays" errors={e.quoteValidityDays} required>
                  <Input {...input("quoteValidityDays")} type="number" min={1} max={365} />
                </Field>
                <Field
                  label="Condições comerciais"
                  htmlFor="defaultTerms"
                  errors={e.defaultTerms}
                  hint="Uma condição por linha. São copiadas para cada novo orçamento."
                  className="sm:col-span-2"
                >
                  <Textarea {...input("defaultTerms")} rows={6} />
                </Field>
              </div>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" loading={pending}>
                Guardar definições
              </Button>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
