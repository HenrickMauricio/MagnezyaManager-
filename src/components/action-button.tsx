"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/server/errors";
import { Button, type ButtonProps } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/** Executa uma ação sem confirmação (operações reversíveis), mostrando o resultado. */
export function ActionButton({
  action,
  ...props
}: Omit<ButtonProps, "onClick" | "action"> & { action: () => Promise<ActionResult> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await action();
          if (!result.ok) toast.error(result.error);
          else if (result.message) toast.success(result.message);
          router.refresh();
        })
      }
      {...props}
    />
  );
}
