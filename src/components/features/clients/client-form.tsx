"use client";

import Link from "next/link";
import type { ActionResult } from "@/server/errors";
import { ActionForm } from "@/components/action-form";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { CLIENT_TYPES, COUNTRIES } from "@/lib/validation/clients";

export type ClientFormValues = {
  type: string;
  name: string;
  nif: string;
  email: string;
  phone: string;
  billingAddress: string;
  postalCode: string;
  city: string;
  country: string;
  notes: string;
  gdprConsent: boolean;
};

export const EMPTY_CLIENT: ClientFormValues = {
  type: "EMPRESA",
  name: "",
  nif: "",
  email: "",
  phone: "",
  billingAddress: "",
  postalCode: "",
  city: "",
  country: "PT",
  notes: "",
  gdprConsent: false,
};

export function ClientForm({
  action,
  initial = EMPTY_CLIENT,
  submitLabel,
  cancelHref,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  initial?: ClientFormValues;
  submitLabel: string;
  cancelHref: string;
}) {
  return (
    <ActionForm action={action}>
      {({ errors: e, pending }) => {
        const input = (name: keyof ClientFormValues) => ({
          id: name,
          name,
          invalid: !!e[name],
          "aria-describedby": `${name}-error`,
        });
        return (
          <>
            <Card>
              <CardHeader title="Identificação" />
              <div className="grid gap-5 p-5 sm:grid-cols-2">
                <Field label="Tipo" htmlFor="type" errors={e.type} required>
                  <Select {...input("type")} defaultValue={initial.type}>
                    {Object.entries(CLIENT_TYPES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="País" htmlFor="country" errors={e.country} required>
                  <Select {...input("country")} defaultValue={initial.country}>
                    {Object.entries(COUNTRIES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Nome" htmlFor="name" errors={e.name} required className="sm:col-span-2">
                  <Input {...input("name")} defaultValue={initial.name} autoComplete="organization" />
                </Field>
                <Field
                  label="NIF"
                  htmlFor="nif"
                  errors={e.nif}
                  hint="Obrigatório. Em Portugal é validado o dígito de controlo."
                  required
                >
                  <Input {...input("nif")} defaultValue={initial.nif} inputMode="text" autoComplete="off" />
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader title="Contactos e morada" description="Dados gerais; as pessoas de contacto gerem-se na ficha do cliente." />
              <div className="grid gap-5 p-5 sm:grid-cols-2">
                <Field label="Email" htmlFor="email" errors={e.email}>
                  <Input {...input("email")} type="email" defaultValue={initial.email} autoComplete="email" />
                </Field>
                <Field label="Telefone" htmlFor="phone" errors={e.phone}>
                  <Input {...input("phone")} type="tel" defaultValue={initial.phone} autoComplete="tel" />
                </Field>
                <Field label="Morada de faturação" htmlFor="billingAddress" errors={e.billingAddress} className="sm:col-span-2">
                  <Input {...input("billingAddress")} defaultValue={initial.billingAddress} autoComplete="street-address" />
                </Field>
                <Field label="Código postal" htmlFor="postalCode" errors={e.postalCode} hint="Em Portugal: 0000-000">
                  <Input {...input("postalCode")} defaultValue={initial.postalCode} autoComplete="postal-code" />
                </Field>
                <Field label="Localidade" htmlFor="city" errors={e.city}>
                  <Input {...input("city")} defaultValue={initial.city} autoComplete="address-level2" />
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader title="Notas e RGPD" />
              <div className="space-y-5 p-5">
                <Field label="Notas internas" htmlFor="notes" errors={e.notes} hint="Não são visíveis para o cliente.">
                  <Textarea {...input("notes")} defaultValue={initial.notes} rows={4} />
                </Field>
                <Checkbox
                  name="gdprConsent"
                  defaultChecked={initial.gdprConsent}
                  label="Consentimento RGPD registado"
                  description="O cliente autorizou o tratamento dos seus dados para fins comerciais."
                />
              </div>
            </Card>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Link href={cancelHref} className={buttonClasses({ variant: "secondary" })}>
                Cancelar
              </Link>
              <Button type="submit" loading={pending}>
                {submitLabel}
              </Button>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
