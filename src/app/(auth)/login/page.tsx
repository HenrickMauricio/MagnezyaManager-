import { Fragment } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { BRAND } from "@/config/brand";
import { homePathFor } from "@/lib/permissions";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sessão" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));
  const { next } = await searchParams;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Painel da marca */}
      <section className="relative hidden overflow-hidden bg-black text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Wordmark />
        <div className="max-w-md">
          <p className="font-display text-[44px] font-semibold leading-[1.05] tracking-tight">
            {BRAND.headline}
          </p>
          <p className="mt-6 text-[15px] leading-relaxed text-white/60">
            {BRAND.description}
          </p>
        </div>
        <div className="flex items-center gap-6 text-[12px] uppercase tracking-[0.2em] text-white/40">
          {BRAND.segments.map((segment, i) => (
            <Fragment key={segment}>
              {i > 0 && <span className="size-1 rounded-full bg-white/30" />}
              <span>{segment}</span>
            </Fragment>
          ))}
        </div>
        {/* Grelha decorativa discreta */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse at 70% 40%, black, transparent 70%)",
          }}
        />
      </section>

      {/* Formulário */}
      <section className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Wordmark className="lg:invisible" subtitle={false} />
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-12">
          <h1 className="font-display text-[30px] font-semibold tracking-tight">Iniciar sessão</h1>
          <p className="mt-2 text-[15px] text-fg-muted">Aceda com as credenciais fornecidas pela {BRAND.name}.</p>
          <LoginForm next={next} />
        </div>
        <p className="text-center text-[12px] text-fg-subtle">
          © {new Date().getFullYear()} {BRAND.name} – {BRAND.tagline}
        </p>
      </section>
    </main>
  );
}
