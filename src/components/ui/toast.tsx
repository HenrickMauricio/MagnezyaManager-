"use client";

import { useSyncExternalStore } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Toast = { id: number; tone: "success" | "error"; message: string };

/** Fila de notificações partilhada pela aplicação (estado fora do React). */
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(tone: Toast["tone"], message: string) {
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, tone, message }];
  emit();
  setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
};

const EMPTY: Toast[] = [];

export function Toaster() {
  const items = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => EMPTY,
  );

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
    >
      {items.map((t) => {
        const Icon = t.tone === "success" ? CircleCheck : CircleAlert;
        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="animate-fade-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg bg-primary px-4 py-3 text-primary-fg shadow-lg"
          >
            <Icon
              className={cn("mt-0.5 size-[18px] shrink-0", t.tone === "error" ? "text-danger" : "text-success")}
              strokeWidth={2}
            />
            <p className="flex-1 text-[14px] leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-mr-1 inline-flex size-6 items-center justify-center rounded opacity-60 hover:opacity-100"
              aria-label="Fechar notificação"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
