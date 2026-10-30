"use client";

import Link from "next/link";
import { useState } from "react";
import { Wand2 } from "lucide-react";
import type { ActionResult } from "@/server/errors";
import { ActionForm } from "@/components/action-form";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { ROLE_KEYS, ROLE_LABELS, type RoleKey } from "@/lib/permissions";
import { generateTemporaryPassword } from "@/lib/user-rules";
import { PASSWORD_MIN } from "@/lib/validation/users";

export type UserFormValues = {
  name: string;
  email: string;
  phone: string;
  role: RoleKey;
  clientId: string;
  /** Percentagem, como texto ("10", "7,5"). */
  maxDiscount: string;
};

export function UserForm({
  action,
  initial,
  clients,
  mode,
  lockRole = false,
  cancelHref,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  initial: UserFormValues;
  clients: { id: string; name: string; nif: string }[];
  mode: "create" | "edit";
  /** O próprio utilizador não pode mudar de perfil. */
  lockRole?: boolean;
  cancelHref: string;
}) {
  const [role, setRole] = useState<RoleKey>(initial.role);
  const [password, setPassword] = useState("");
  const isClient = role === "CLIENTE";

  return (
    <ActionForm action={action}>
      {({ errors: e, pending }) => (
        <>
          <Card>
            <CardHeader title="Dados da conta" />
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <Field label="Nome" htmlFor="name" errors={e.name} required className="sm:col-span-2">
                <Input id="name" name="name" defaultValue={initial.name} invalid={!!e.name} autoComplete="off" />
              </Field>
              <Field label="Email" htmlFor="email" errors={e.email} required hint="Usado para iniciar sessão.">
                <Input id="email" name="email" type="email" defaultValue={initial.email} invalid={!!e.email} autoComplete="off" />
              </Field>
              <Field label="Telefone" htmlFor="phone" errors={e.phone}>
                <Input id="phone" name="phone" type="tel" defaultValue={initial.phone} invalid={!!e.phone} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Perfil e acesso" />
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <Field
                label="Perfil"
                htmlFor="role"
                errors={e.role}
                required
                hint={lockRole ? "Não pode alterar o seu próprio perfil." : undefined}
              >
                <Select
                  id="role"
                  name={lockRole ? undefined : "role"}
                  value={role}
                  onChange={(ev) => setRole(ev.target.value as RoleKey)}
                  disabled={lockRole}
                  invalid={!!e.role}
                >
                  {ROLE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {ROLE_LABELS[key]}
                    </option>
                  ))}
                </Select>
                {lockRole && <input type="hidden" name="role" value={role} />}
              </Field>

              {isClient ? (
                <Field label="Cliente" htmlFor="clientId" errors={e.clientId} required hint="Empresa ou particular a que esta conta dá acesso.">
                  <Select id="clientId" name="clientId" defaultValue={initial.clientId} invalid={!!e.clientId}>
                    <option value="">Escolher cliente…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.nif}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field
                  label="Desconto máximo sem aprovação (%)"
                  htmlFor="maxDiscountBp"
                  errors={e.maxDiscountBp}
                  hint="Acima deste valor, o orçamento precisa de aprovação de um administrador."
                >
                  <Input
                    id="maxDiscountBp"
                    name="maxDiscountBp"
                    inputMode="decimal"
                    defaultValue={initial.maxDiscount}
                    invalid={!!e.maxDiscountBp}
                  />
                </Field>
              )}
              {/* Campos do perfil não visível são enviados vazios. */}
              {isClient ? <input type="hidden" name="maxDiscountBp" value="" /> : <input type="hidden" name="clientId" value="" />}
            </div>
          </Card>

          {mode === "create" && (
            <Card>
              <CardHeader
                title="Palavra-passe temporária"
                description="Comunique-a ao utilizador por um canal seguro. Terá de a alterar no primeiro login."
              />
              <div className="p-5">
                <Field
                  label="Palavra-passe"
                  htmlFor="password"
                  errors={e.password}
                  required
                  hint={`Pelo menos ${PASSWORD_MIN} caracteres.`}
                >
                  <div className="flex gap-2">
                    <Input
                      id="password"
                      name="password"
                      value={password}
                      onChange={(ev) => setPassword(ev.target.value)}
                      invalid={!!e.password}
                      autoComplete="new-password"
                      className="font-mono"
                    />
                    <Button type="button" variant="secondary" className="h-11 shrink-0" onClick={() => setPassword(generateTemporaryPassword())}>
                      <Wand2 className="size-4" /> Gerar
                    </Button>
                  </div>
                </Field>
              </div>
            </Card>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link href={cancelHref} className={buttonClasses({ variant: "secondary" })}>
              Cancelar
            </Link>
            <Button type="submit" loading={pending}>
              {mode === "create" ? "Criar utilizador" : "Guardar alterações"}
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
