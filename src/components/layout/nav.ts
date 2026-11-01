import type { Permission } from "@/lib/permissions";

export type NavIcon =
  | "dashboard"
  | "quotes"
  | "calendar"
  | "availability"
  | "rentals"
  | "articles"
  | "categories"
  | "inventory"
  | "clients"
  | "users"
  | "reports"
  | "settings";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
  permission: Permission;
  /** Fase em que o módulo fica disponível; ausente = já disponível. */
  availableInPhase?: number;
};

export type NavGroup = { label: string; items: NavItem[] };

/**
 * Navegação da área interna. Módulos ainda não implementados aparecem
 * desativados com a indicação "Brevemente" (nunca como links sem destino).
 */
export const NAV: NavGroup[] = [
  {
    label: "Geral",
    items: [{ label: "Painel", href: "/painel", icon: "dashboard", permission: "dashboard:view" }],
  },
  {
    label: "Comercial",
    items: [
      { label: "Orçamentos", href: "/orcamentos", icon: "quotes", permission: "quote:view" },
      { label: "Clientes", href: "/clientes", icon: "clients", permission: "client:view" },
    ],
  },
  {
    label: "Operação",
    items: [
      { label: "Calendário", href: "/calendario", icon: "calendar", permission: "calendar:view" },
      { label: "Disponibilidade", href: "/disponibilidade", icon: "availability", permission: "availability:view" },
      { label: "Reservas", href: "/reservas", icon: "rentals", permission: "rental:view" },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { label: "Artigos", href: "/artigos", icon: "articles", permission: "article:view" },
      { label: "Categorias", href: "/categorias", icon: "categories", permission: "category:manage" },
      { label: "Inventário", href: "/inventario", icon: "inventory", permission: "inventory:manage" },
    ],
  },
  {
    label: "Administração",
    items: [
      { label: "Utilizadores", href: "/utilizadores", icon: "users", permission: "user:manage" },
      { label: "Relatórios", href: "/relatorios", icon: "reports", permission: "report:view" },
      { label: "Definições", href: "/definicoes", icon: "settings", permission: "settings:manage" },
    ],
  },
];

/** Filtra a navegação pelas permissões do utilizador (grupos vazios desaparecem). */
export function navForPermissions(permissions: readonly string[]): NavGroup[] {
  const set = new Set(permissions);
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => set.has(i.permission)) })).filter(
    (g) => g.items.length > 0,
  );
}
