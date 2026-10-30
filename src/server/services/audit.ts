import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

type AuditInput = {
  actorId: string | null;
  action: string; // ex.: "auth.login", "article.update"
  entity: string; // ex.: "User", "Article"
  entityId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
};

type Db = Pick<typeof prisma, "auditLog">;

/**
 * Regista uma operação relevante. Aceita um cliente de transação para que o
 * registo fique na mesma transação da alteração auditada.
 * Falhas de auditoria fora de transação nunca interrompem a operação principal.
 */
export async function logAudit(input: AuditInput, db: Db = prisma): Promise<void> {
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
    userAgent = h.get("user-agent");
  } catch {
    // fora de um pedido (ex.: scripts) — sem cabeçalhos
  }

  const write = db.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      before: input.before ?? undefined,
      after: input.after ?? undefined,
      ip,
      userAgent: userAgent?.slice(0, 500) ?? null,
    },
  });

  if (db === prisma) {
    await write.catch((err: unknown) => console.error("[audit] falha ao registar", err));
  } else {
    await write;
  }
}
