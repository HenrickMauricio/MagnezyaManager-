import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

const iconButton =
  "inline-flex size-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg";

export function UserMenu({
  name,
  roleName,
  showPasswordLink = true,
}: {
  name: string;
  roleName: string;
  showPasswordLink?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <div className="text-[13px] font-semibold leading-tight">{name}</div>
        <div className="text-[12px] leading-tight text-fg-muted">{roleName}</div>
      </div>
      <div
        className="flex size-9 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-fg"
        aria-hidden
      >
        {initials(name)}
      </div>
      {showPasswordLink && (
        <Link
          href="/alterar-palavra-passe"
          className={iconButton}
          aria-label="Alterar palavra-passe"
          title="Alterar palavra-passe"
        >
          <KeyRound className="size-[18px]" strokeWidth={1.75} />
        </Link>
      )}
      <form action={logoutAction}>
        <button
          type="submit"
          className={iconButton}
          aria-label="Terminar sessão"
          title="Terminar sessão"
        >
          <LogOut className="size-[18px]" strokeWidth={1.75} />
        </button>
      </form>
    </div>
  );
}
