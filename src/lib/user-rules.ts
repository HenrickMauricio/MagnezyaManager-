/**
 * Regras de gestão de utilizadores que não dependem da base de dados.
 * Módulo puro, testado em tests/unit/user-rules.test.ts.
 */
import { ALL_PERMISSIONS, isInternalRole, type Permission, type RoleKey } from "@/lib/permissions";

/** Permissões que podem ser concedidas/retiradas individualmente a um utilizador deste papel. */
export function overridablePermissions(role: RoleKey): Permission[] {
  if (!isInternalRole(role)) return [];
  return ALL_PERMISSIONS.filter((p) => !p.startsWith("portal:"));
}

type UserState = { id: string; role: RoleKey; active: boolean };

/**
 * Valida uma alteração de papel/estado. Devolve a mensagem de erro, ou null se permitida.
 *
 * - Ninguém altera o próprio papel nem se desativa a si próprio.
 * - Tem de existir sempre pelo menos um administrador ativo.
 */
export function checkUserStateChange(params: {
  actorId: string;
  before: UserState;
  after: Pick<UserState, "role" | "active">;
  activeAdminCount: number;
}): string | null {
  const { actorId, before, after, activeAdminCount } = params;
  const isSelf = actorId === before.id;

  if (isSelf && after.role !== before.role) return "Não pode alterar o seu próprio perfil.";
  if (isSelf && !after.active && before.active) return "Não pode desativar a sua própria conta.";

  const wasActiveAdmin = before.role === "ADMIN" && before.active;
  const staysActiveAdmin = after.role === "ADMIN" && after.active;
  if (wasActiveAdmin && !staysActiveAdmin && activeAdminCount <= 1) {
    return "Tem de existir pelo menos um administrador ativo.";
  }
  return null;
}

/** Gera uma palavra-passe temporária legível (sem caracteres ambíguos). */
export function generateTemporaryPassword(length = 14): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
