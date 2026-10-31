import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { requireClientPage } from "@/server/auth/session";
import { getPortalAccount } from "@/server/services/portal";
import { BRAND } from "@/config/brand";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DetailList, PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "A minha conta" };

export default async function PortalAccountPage() {
  const user = await requireClientPage();
  const c = await getPortalAccount(user);
  const address = [c.billingAddress, [c.postalCode, c.city].filter(Boolean).join(" ")].filter(Boolean).join("\n");

  return (
    <div className="space-y-6">
      <PageHeader
        title="A minha conta"
        description={`Para alterar os dados da empresa ou os contactos, fale com a ${BRAND.name}.`}
        actions={
          <Link href="/alterar-palavra-passe" className={buttonClasses({ variant: "secondary" })}>
            <KeyRound className="size-4" /> Alterar palavra-passe
          </Link>
        }
      />
      <Card>
        <CardHeader title="Utilizador" />
        <DetailList
          items={[
            { label: "Nome", value: user.name },
            { label: "Email de acesso", value: user.email },
          ]}
        />
      </Card>
      <Card>
        <CardHeader title="Empresa" />
        <DetailList
          items={[
            { label: "Nome", value: c.name },
            { label: "NIF", value: c.nif },
            { label: "Email", value: c.email },
            { label: "Telefone", value: c.phone },
            { label: "Morada de faturação", value: address || null, wide: true },
          ]}
        />
      </Card>
      {c.contacts.length > 0 && (
        <Card>
          <CardHeader title="Contactos" />
          <ul className="divide-y divide-border">
            {c.contacts.map((p, i) => (
              <li key={i} className="px-5 py-3 text-[14px]">
                <div className="flex items-center gap-2 font-medium">
                  {p.name}
                  {p.isPrimary && <Badge>Principal</Badge>}
                </div>
                <div className="text-[13px] text-fg-muted">{[p.jobTitle, p.email, p.phone].filter(Boolean).join(" · ") || "—"}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
