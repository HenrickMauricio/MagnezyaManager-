import { prisma } from "../../src/server/db";
import type { CurrentUser } from "../../src/server/auth/session";
import { ROLE_DEFAULT_PERMISSIONS, type Permission, type RoleKey } from "../../src/lib/permissions";

/** Prefixo de SKU único (6 letras aleatórias). */
export const uniquePrefix = () =>
  Array.from({ length: 6 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");

/** Utilizador de teste com as permissões por omissão do papel. */
export async function makeUser(role: RoleKey, email: string, maxDiscountBp: number): Promise<CurrentUser> {
  const r = await prisma.role.upsert({ where: { key: role }, update: {}, create: { key: role, name: role } });
  const u = await prisma.user.upsert({
    where: { email },
    update: { maxDiscountBp },
    create: { email, name: email.split("@")[0]!, roleId: r.id, maxDiscountBp },
  });
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role,
    roleName: role,
    clientId: null,
    maxDiscountBp,
    mustChangePassword: false,
    permissions: new Set<Permission>(ROLE_DEFAULT_PERMISSIONS[role]),
  };
}

export async function defaultTaxRate() {
  return prisma.taxRate.upsert({
    where: { name_region: { name: "Taxa normal", region: "CONTINENTE" } },
    update: {},
    create: { name: "Taxa normal", rateBp: 2300, region: "CONTINENTE", isDefault: true },
  });
}
