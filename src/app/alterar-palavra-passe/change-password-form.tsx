"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PASSWORD_MIN } from "@/lib/validation/users";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePasswordAction, {});
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      {state.error && (
        <div role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-[14px] text-danger">
          {state.error}
        </div>
      )}
      <Field label="Palavra-passe atual" htmlFor="currentPassword" errors={e.currentPassword}>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          autoFocus
          invalid={!!e.currentPassword}
          aria-describedby="currentPassword-error"
        />
      </Field>
      <Field
        label="Nova palavra-passe"
        htmlFor="newPassword"
        hint={`Pelo menos ${PASSWORD_MIN} caracteres.`}
        errors={e.newPassword}
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          invalid={!!e.newPassword}
          aria-describedby="newPassword-error"
        />
      </Field>
      <Field label="Confirmar nova palavra-passe" htmlFor="confirmPassword" errors={e.confirmPassword}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          invalid={!!e.confirmPassword}
          aria-describedby="confirmPassword-error"
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Guardar palavra-passe
      </Button>
    </form>
  );
}
