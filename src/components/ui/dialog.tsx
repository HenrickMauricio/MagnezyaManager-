"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { ActionResult } from "@/server/errors";
import { Button, type ButtonProps } from "./button";
import { toast } from "./toast";

/**
 * Janela modal acessível baseada no <dialog> nativo
 * (foco preso, tecla Esc e fundo inerte geridos pelo browser).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-border bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/50 open:animate-fade-in"
    >
      {open && (
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-[18px] font-semibold tracking-tight">{title}</h2>
              {description && <p className="mt-1 text-[14px] text-fg-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg"
              aria-label="Fechar"
            >
              <X className="size-[18px]" strokeWidth={1.75} />
            </button>
          </div>
          <div className="mt-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/**
 * Botão que pede confirmação antes de executar uma ação (obrigatório em
 * ações destrutivas). Mostra o resultado numa notificação e atualiza a página.
 */
export function ConfirmButton({
  action,
  title,
  description,
  confirmLabel,
  children,
  tone = "danger",
  ...buttonProps
}: Omit<ButtonProps, "onClick" | "action"> & {
  action: () => Promise<ActionResult>;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function confirm() {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setOpen(false);
        if (result.message) toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} {...buttonProps}>
        {children}
      </Button>
      <Dialog open={open} onClose={() => !pending && setOpen(false)} title={title} description={description}>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" variant={tone} onClick={confirm} loading={pending}>
            {confirmLabel}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
