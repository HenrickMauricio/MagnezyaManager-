"use client";

import { useState } from "react";
import { setUserPermissionsAction } from "@/server/actions/users";
import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/cn";

type Choice = "default" | "grant" | "revoke";

const GROUPS: { label: string; prefixes: string[] }[] = [
  { label: "Painel e relatórios", prefixes: ["dashboard", "report"] },
  { label: "Clientes", prefixes: ["client"] },
  { label: "Orçamentos", prefixes: ["quote"] },
  { label: "Catálogo e inventário", prefixes: ["article", "category", "inventory", "availability"] },
  { label: "Calendário e reservas", prefixes: ["calendar", "rental"] },
  { label: "Administração", prefixes: ["user", "settings", "audit"] },
];

export function PermissionsForm({
  userId,
  permissions,
  roleDefaults,
  initial,
  readOnly,
}: {
  userId: string;
  permissions: Permission[];
  roleDefaults: Permission[];
  initial: Partial<Record<Permission, Choice>>;
  readOnly: boolean;
}) {
  const [choices, setChoices] = useState(initial);
  const defaults = new Set(roleDefaults);
  const changed = permissions.some((p) => (choices[p] ?? "default") !== (initial[p] ?? "default"));

  return (
    <ActionForm action={setUserPermissionsAction.bind(null, userId)} className="space-y-0">
      {({ pending }) => (
        <>
          <div className="divide-y divide-border">
            {GROUPS.map((group) => {
              const perms = permissions.filter((p) => group.prefixes.includes(p.split(":")[0]!));
              if (perms.length === 0) return null;
              return (
                <fieldset key={group.label} className="px-5 py-4">
                  <legend className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-fg-muted">
                    {group.label}
                  </legend>
                  <ul className="space-y-2">
                    {perms.map((p) => {
                      const choice = choices[p] ?? "default";
                      const effective = choice === "default" ? defaults.has(p) : choice === "grant";
                      return (
                        <li key={p} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={cn("size-2 shrink-0 rounded-full", effective ? "bg-success" : "bg-border-strong")}
                              aria-hidden
                            />
                            <span className={cn("text-[14px]", !effective && "text-fg-muted")}>{PERMISSIONS[p]}</span>
                            {choice !== "default" && <Badge tone="info">Individual</Badge>}
                          </div>
                          <Select
                            name={`perm:${p}`}
                            aria-label={PERMISSIONS[p]}
                            value={choice}
                            disabled={readOnly}
                            onChange={(e) => setChoices({ ...choices, [p]: e.target.value as Choice })}
                            className="w-full sm:w-56 [&_select]:h-9 [&_select]:text-[13px]"
                          >
                            <option value="default">Padrão do perfil ({defaults.has(p) ? "sim" : "não"})</option>
                            {!defaults.has(p) && <option value="grant">Conceder</option>}
                            {defaults.has(p) && <option value="revoke">Retirar</option>}
                          </Select>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              );
            })}
          </div>
          {!readOnly && (
            <div className="flex justify-end border-t border-border px-5 py-4">
              <Button type="submit" loading={pending} disabled={!changed}>
                Guardar permissões
              </Button>
            </div>
          )}
        </>
      )}
    </ActionForm>
  );
}
