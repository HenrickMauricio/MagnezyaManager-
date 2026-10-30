import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Numeração de documentos sem buracos e sem repetições, por prefixo e ano
 * ("RES-2026-0001", "ORC-2026-0001"). O upsert com incremento é atómico no
 * PostgreSQL (INSERT … ON CONFLICT DO UPDATE) e fica na transação do documento:
 * se esta falhar, o número não é consumido.
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  prefix: string,
  year: number,
): Promise<string> {
  const key = `${prefix}-${year}`;
  const seq = await tx.documentSequence.upsert({
    where: { key },
    create: { key, last: 1 },
    update: { last: { increment: 1 } },
  });
  return `${key}-${String(seq.last).padStart(4, "0")}`;
}
