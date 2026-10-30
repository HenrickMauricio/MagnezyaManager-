/**
 * Núcleo do processamento de imagens, partilhado com scripts.
 * Na aplicação importar de "@/server/services/images".
 */
import sharp from "sharp";
import { ConflictError } from "@/server/errors";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "heif", "avif"]);

/**
 * Prepara uma fotografia para o catálogo (risco R8 do plano):
 * corrige a orientação, remove metadados (ex.: GPS) e gera duas versões WebP —
 * grande (máx. 1600 px, para o PDF) e miniatura (máx. 480 px, para listas).
 */
export async function processArticleImage(input: Buffer): Promise<{ full: Buffer; thumb: Buffer }> {
  if (input.byteLength > MAX_IMAGE_BYTES) throw new ConflictError("A fotografia excede 8 MB.");

  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new ConflictError("O ficheiro não é uma imagem válida.");
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) {
    throw new ConflictError("Formato não suportado. Use JPEG, PNG, WebP ou HEIC.");
  }

  const base = sharp(input, { limitInputPixels: 60_000_000 }).rotate();
  const [full, thumb] = await Promise.all([
    base.clone().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    base.clone().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
  ]);
  return { full, thumb };
}
