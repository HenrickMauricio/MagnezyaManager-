"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { loginAction, type LoginState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { BRAND } from "@/config/brand";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      {state.error && (
        <div role="alert" className="animate-fade-in rounded-md bg-danger-bg px-4 py-3 text-[14px] text-danger">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          defaultValue={state.email}
          invalid={!!state.fieldErrors?.email}
          aria-describedby="email-error"
          placeholder="nome@empresa.pt"
        />
        <FieldError id="email-error" messages={state.fieldErrors?.email} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Palavra-passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          invalid={!!state.fieldErrors?.password}
          aria-describedby="password-error"
        />
        <FieldError id="password-error" messages={state.fieldErrors?.password} />
      </div>

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? "A entrar…" : "Entrar"}
        {!pending && <ArrowRight className="size-4" strokeWidth={2} />}
      </Button>

      <p className="text-center text-[13px] text-fg-subtle">
        Esqueceu-se da palavra-passe? Contacte o administrador da {BRAND.name}.
      </p>
    </form>
  );
}
