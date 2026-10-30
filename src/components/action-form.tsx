"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/server/errors";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

export type FormErrors = Record<string, string[] | undefined>;

/**
 * Formulário ligado a uma Server Action que devolve ActionResult.
 * Não limpa os campos quando há erros; em caso de sucesso mostra a mensagem
 * e navega para `redirectTo` (ou atualiza a página).
 */
export function ActionForm({
  action,
  children,
  onSuccess,
  className,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: (state: { errors: FormErrors; pending: boolean }) => ReactNode;
  onSuccess?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <form
      noValidate
      className={cn("space-y-6", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await action(formData);
          if (result.ok) {
            setErrors({});
            setFormError(null);
            if (result.message) toast.success(result.message);
            onSuccess?.();
            if (result.redirectTo) router.push(result.redirectTo);
            else router.refresh();
          } else {
            setErrors(result.fieldErrors ?? {});
            setFormError(result.fieldErrors ? null : result.error);
            if (result.fieldErrors) toast.error(result.error);
          }
        });
      }}
    >
      {formError && (
        <div role="alert" className="animate-fade-in rounded-md bg-danger-bg px-4 py-3 text-[14px] text-danger">
          {formError}
        </div>
      )}
      {children({ errors, pending })}
    </form>
  );
}
