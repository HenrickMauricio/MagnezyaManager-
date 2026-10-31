/**
 * Recupera os PDFs de versões emitidas cujo ficheiro desapareceu (ex.: cópia de
 * segurança reposta sem a pasta de ficheiros). Cada PDF é gerado de novo a
 * partir do snapshot imutável da versão — os mesmos valores, a mesma
 * apresentação — e guardado na mesma chave; o novo SHA-256 fica registado,
 * com uma entrada de auditoria por versão recuperada.
 *
 *   npm run pdfs:regenerar             recupera os PDFs em falta
 *   npm run pdfs:regenerar -- --ver    só lista, sem alterar nada
 *
 * Versões cujo ficheiro existe e corresponde ao hash nunca são tocadas.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { prisma } from "../src/server/db";
import { getObject, putObject } from "../src/server/files/storage-local";
import { renderQuotePdf } from "../src/server/pdf/quote-pdf";
import type { QuoteSnapshot } from "../src/lib/quote-snapshot";

const dryRun = process.argv.includes("--ver");
const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");

async function main() {
  const versions = await prisma.quoteVersion.findMany({
    where: { pdfStorageKey: { not: null } },
    orderBy: [{ quoteId: "asc" }, { versionNumber: "asc" }],
    select: { id: true, quoteId: true, versionNumber: true, snapshot: true, pdfStorageKey: true, pdfSha256: true, quote: { select: { number: true } } },
  });

  let missing = 0;
  let altered = 0;
  for (const v of versions) {
    const label = `${v.quote.number} v${v.versionNumber}`;
    const existing = await getObject(v.pdfStorageKey!);
    if (existing) {
      if (v.pdfSha256 && sha(existing) !== v.pdfSha256) {
        altered++;
        console.warn(`! ${label}: o ficheiro existe mas não corresponde ao hash original — não é alterado.`);
      }
      continue;
    }
    missing++;
    if (dryRun) {
      console.log(`- ${label}: PDF em falta`);
      continue;
    }
    const pdf = await renderQuotePdf(v.snapshot as unknown as QuoteSnapshot);
    await putObject(v.pdfStorageKey!, pdf);
    const hash = sha(pdf);
    await prisma.$transaction([
      prisma.quoteVersion.update({ where: { id: v.id }, data: { pdfSha256: hash } }),
      prisma.auditLog.create({
        data: {
          actorId: null,
          action: "quote.pdf_regenerated",
          entity: "Quote",
          entityId: v.quoteId,
          before: { version: v.versionNumber, sha256: v.pdfSha256 },
          after: { version: v.versionNumber, sha256: hash, reason: "ficheiro em falta; gerado de novo a partir do snapshot" },
        },
      }),
    ]);
    console.log(`✓ ${label}: PDF gerado de novo a partir do snapshot`);
  }

  console.log(
    `${versions.length} versões verificadas · ${missing} sem ficheiro${dryRun ? "" : " (recuperadas)"} · ${altered} com ficheiro alterado`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
