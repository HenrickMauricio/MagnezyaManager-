/**
 * Descarrega as fotografias do catálogo de demonstração (magnezya.pt, uso
 * autorizado) e associa-as aos artigos, com o mesmo processamento das
 * fotografias carregadas na aplicação (WebP 1600 px + miniatura).
 *
 *   npm run catalogo:imagens            todos os artigos sem fotografias
 *   npm run catalogo:imagens -- 10      só os primeiros 10 (teste)
 *
 * Idempotente: artigos que já têm fotografias são ignorados.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { processArticleImage } from "../src/server/files/image-processing";
import { deleteObject, putObject } from "../src/server/files/storage-local";
import { newArticleImageKey, thumbKey } from "../src/lib/files";
import type { CatalogData } from "../prisma/data/catalog-types";

const CONCURRENCY = 4;
const TIMEOUT_MS = 30_000;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const catalog = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "..", "prisma", "data", "catalogo-magnezya.json"), "utf8"),
) as CatalogData;

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) throw new Error(`não é uma imagem (${type})`);
  return Buffer.from(await res.arrayBuffer());
}

async function importItem(item: CatalogData["items"][number]): Promise<{ added: number; failed: string[] }> {
  const article = await prisma.article.findUnique({
    where: { sku: item.sku },
    select: { id: true, name: true, _count: { select: { images: true } } },
  });
  if (!article || article._count.images > 0 || item.images.length === 0) return { added: 0, failed: [] };

  const failed: string[] = [];
  let added = 0;
  for (const url of item.images) {
    let key: string | null = null;
    try {
      const { full, thumb } = await processArticleImage(await download(url));
      key = newArticleImageKey(article.id);
      await putObject(key, full);
      await putObject(thumbKey(key), thumb);
      await prisma.articleImage.create({
        data: { articleId: article.id, storageKey: key, alt: article.name, sortOrder: added, isPrimary: added === 0 },
      });
      added++;
    } catch (err) {
      if (key) await Promise.all([deleteObject(key), deleteObject(thumbKey(key))]);
      failed.push(`${item.sku} ${url.split("/").pop()}: ${(err as Error).message}`);
    }
  }
  return { added, failed };
}

async function main() {
  const limit = Number(process.argv[2]) || Infinity;
  const queue = catalog.items.filter((i) => i.images.length > 0).slice(0, limit);
  let done = 0;
  let images = 0;
  const failures: string[] = [];

  async function worker() {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const result = await importItem(item);
      images += result.added;
      failures.push(...result.failed);
      done++;
      if (done % 20 === 0) console.log(`… ${done} artigos processados, ${images} fotografias`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`Concluído: ${done} artigos verificados, ${images} fotografias adicionadas.`);
  if (failures.length) console.log(`Falharam ${failures.length}:\n  ${failures.join("\n  ")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
