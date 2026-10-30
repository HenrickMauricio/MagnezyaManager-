/**
 * Catálogo central de permissões e regras de resolução.
 *
 * Fonte única de verdade: o seed sincroniza este catálogo com a base de dados
 * e o servidor usa `resolvePermissions` para decidir o acesso.
 * Módulo puro (sem dependências), para poder ser testado isoladamente.
 */

export const ROLE_KEYS = ["ADMIN", "VENDEDOR", "CLIENTE"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  ADMIN: "Administrador",
  VENDEDOR: "Vendedor",
  CLIENTE: "Cliente (portal)",
};

export const PERMISSIONS = {
  // Painel e relatórios
  "dashboard:view": "Ver o painel interno",
  "report:view": "Ver relatórios",

  // Utilizadores e configuração
  "user:manage": "Criar, editar e desativar utilizadores",
  "settings:manage": "Configurar dados da empresa, IVA e serviços",
  "audit:view": "Consultar o registo de auditoria",

  // Clientes
  "client:view": "Consultar clientes",
  "client:create": "Criar clientes",
  "client:edit": "Editar clientes",
  "client:delete": "Arquivar clientes",

  // Catálogo e inventário
  "article:view": "Consultar artigos e inventário",
  "article:write": "Criar e editar artigos",
  "article:delete": "Arquivar artigos",
  "category:manage": "Gerir categorias",
  "inventory:manage": "Registar movimentos de stock e manutenção",
  "availability:view": "Consultar disponibilidade",

  // Calendário e reservas
  "calendar:view": "Ver o calendário de alugueres",
  "rental:view": "Consultar reservas e alugueres",
  "rental:manage": "Gerir entregas, devoluções e estados de reservas",

  // Orçamentos
  "quote:view": "Consultar orçamentos",
  "quote:create": "Criar orçamentos",
  "quote:edit_own": "Editar os próprios orçamentos",
  "quote:edit_any": "Editar orçamentos de qualquer vendedor",
  "quote:approve_internal": "Aprovar descontos acima do limite do vendedor",
  "quote:send": "Emitir e enviar orçamentos",
  "quote:cancel": "Cancelar orçamentos",

  // Portal do cliente
  "portal:access": "Aceder ao portal do cliente",
  "portal:quote_respond": "Aprovar ou rejeitar propostas no portal",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Permissões por omissão de cada papel. */
export const ROLE_DEFAULT_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  ADMIN: ALL_PERMISSIONS.filter((p) => !p.startsWith("portal:")),
  VENDEDOR: [
    "dashboard:view",
    "client:view",
    "client:create",
    "client:edit",
    "article:view",
    "availability:view",
    "calendar:view",
    "rental:view",
    "quote:view",
    "quote:create",
    "quote:edit_own",
    "quote:send",
    "quote:cancel",
  ],
  CLIENTE: ["portal:access", "portal:quote_respond"],
};

/** Papéis com acesso à área interna (sidebar de gestão). */
export const INTERNAL_ROLES: readonly RoleKey[] = ["ADMIN", "VENDEDOR"];

export function isInternalRole(role: RoleKey): boolean {
  return INTERNAL_ROLES.includes(role);
}

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

/**
 * Calcula as permissões efetivas de um utilizador:
 * permissões do papel + concessões individuais − revogações individuais.
 * Chaves desconhecidas (ex.: permissões antigas na BD) são ignoradas.
 */
export function resolvePermissions(
  rolePermissions: readonly string[],
  overrides: readonly { key: string; granted: boolean }[] = [],
): Set<Permission> {
  const result = new Set<Permission>();
  for (const key of rolePermissions) if (isPermission(key)) result.add(key);
  for (const o of overrides) {
    if (!isPermission(o.key)) continue;
    if (o.granted) result.add(o.key);
    else result.delete(o.key);
  }
  return result;
}

/**
 * Regra de edição de orçamentos (decisão D5):
 * vendedores veem todos, editam só os seus; quem tem `quote:edit_any` edita todos.
 */
export function canEditQuote(
  user: { id: string; permissions: ReadonlySet<Permission> },
  quote: { createdById: string },
): boolean {
  if (user.permissions.has("quote:edit_any")) return true;
  return user.permissions.has("quote:edit_own") && quote.createdById === user.id;
}

/** Página inicial após login, conforme o papel. */
export function homePathFor(role: RoleKey): string {
  return role === "CLIENTE" ? "/portal" : "/painel";
}
