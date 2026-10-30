import { requireInternalPage } from "@/server/auth/session";
import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { navForPermissions } from "@/components/layout/nav";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/brand";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireInternalPage();
  const groups = navForPermissions([...user.permissions]);

  return (
    <div className="flex min-h-dvh">
      <Sidebar groups={groups} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-bg/85 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-2">
            <MobileNav groups={groups} />
            <Wordmark subtitle={false} className="lg:hidden [&>div]:text-[15px]" />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="mx-1 h-6 w-px bg-border" />
            <UserMenu name={user.name} roleName={user.roleName} />
          </div>
        </header>
        <main className="flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
