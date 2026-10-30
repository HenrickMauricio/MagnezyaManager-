/**
 * Núcleo do armazenamento, sem a marca "server-only" para poder ser usado
 * também por scripts (ex.: importação do catálogo). Na aplicação importar
 * sempre de "@/server/services/storage".
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Armazenamento de ficheiros (fotografias, mais tarde PDFs).
 *
 * Driver atual: disco local em STORAGE_DIR (por omissão ./storage), suficiente
 * para desenvolvimento e para um servidor único. O driver S3 compatível
 * (R2 / S3 UE) entra quando o alojamento for decidido (D7, Fase 8) — mantendo
 * esta interface, o resto do código não muda.
 */
// Pasta de dados escolhida em tempo de execução: não deve entrar no pacote do servidor.
const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? "storage");

/** Chaves aceites: segmentos simples, sem "..", com extensão conhecida. */
const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*\.(webp|jpg|png|pdf)$/;

export function isValidStorageKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

function resolveKey(key: string): string {
  if (!isValidStorageKey(key)) throw new Error(`Chave de armazenamento inválida: ${key}`);
  return path.join(/*turbopackIgnore: true*/ ROOT, ...key.split("/"));
}

export async function putObject(key: string, data: Buffer): Promise<void> {
  const file = resolveKey(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
}

export async function getObject(key: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveKey(key));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await rm(resolveKey(key), { force: true });
}

export const CONTENT_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
};
