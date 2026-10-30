import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { requireSessionPage } from "@/server/auth/session";
import { homePathFor } from "@/lib/permissions";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Alterar palavra-passe" };

export default async function ChangePasswordPage() {
  const user = await requireSessionPage();
  const forced = user.mustChangePassword;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-8">
          <Wordmark subtitle={false} className="[&>div]:text-[15px]" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="mx-1 h-6 w-px bg-border" />
            <UserMenu name={user.name} roleName={user.roleName} showPasswordLink={false} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[420px] flex-1 px-4 py-14">
        {!forced && (
          <Link
            href={homePathFor(user.role)}
            className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted hover:text-fg"
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            Voltar
          </Link>
        )}
        <KeyRound className="size-8 text-fg-subtle" strokeWidth={1.5} />
        <h1 className="mt-4 font-display text-[28px] font-semibold tracking-tight">
          {forced ? "Defina a sua palavra-passe" : "Alterar palavra-passe"}
        </h1>
        <p className="mt-2 text-[15px] text-fg-muted">
          {forced
            ? "A sua conta tem uma palavra-passe temporária. Escolha uma nova para continuar."
            : "As outras sessões abertas com a sua conta serão terminadas."}
        </p>
        <ChangePasswordForm />
      </main>
    </div>
  );
}
