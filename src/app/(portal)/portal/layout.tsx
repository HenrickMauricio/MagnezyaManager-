import { requireClientPage } from "@/server/auth/session";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { PortalNav } from "@/components/layout/portal-nav";
import { countPendingProposals } from "@/server/services/portal";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClientPage();
  const pending = await countPendingProposals(user);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Wordmark subtitle={false} className="[&>div]:text-[15px]" />
            <span className="hidden text-[12px] font-medium uppercase tracking-[0.2em] text-fg-subtle sm:inline">
              Portal do cliente
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="mx-1 h-6 w-px bg-border" />
            <UserMenu name={user.name} roleName="Cliente" />
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-1 sm:px-5">
          <PortalNav pending={pending} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-8">{children}</main>
    </div>
  );
}
