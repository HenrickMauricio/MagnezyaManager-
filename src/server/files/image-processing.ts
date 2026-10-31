/**
 * Núcleo do processamento de imagens, partilhado com scripts.
 * Na aplicação importar de "@/server/services/images".
 */
import sharp from "sharp";
import { ConflictError } from "@/server/errors";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "heif", "avif"]);

/** Recusa ficheiros grandes demais, que não são imagens ou em formatos não suportados. */
async function assertSupportedImage(input: Buffer): Promise<void> {
  if (input.byteLength > MAX_IMAGE_BYTES) throw new ConflictError("A imagem excede 8 MB.");
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new ConflictError("O ficheiro não é uma imagem válida.");
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) {
    throw new ConflictError("Formato não suportado. Use JPEG, PNG, WebP ou HEIC.");
  }
}

/**
 * Prepara uma fotografia para o catálogo (risco R8 do plano):
 * corrige a orientação, remove metadados (ex.: GPS) e gera duas versões WebP —
 * grande (máx. 1600 px, para o PDF) e miniatura (máx. 480 px, para listas).
 */
export async function processArticleImage(input: Buffer): Promise<{ full: Buffer; thumb: Buffer }> {
  await assertSupportedImage(input);
  const base = sharp(input, { limitInputPixels: 60_000_000 }).rotate();
  const [full, thumb] = await Promise.all([
    base.clone().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    base.clone().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
  ]);
  return { full, thumb };
}

/** Logótipo da empresa: PNG (mantém a transparência), máx. 800 × 300 px, sem metadados. */
export async function processLogo(input: Buffer): Promise<Buffer> {
  await assertSupportedImage(input);
  return sharp(input, { limitInputPixels: 60_000_000 })
    .rotate()
    .resize({ width: 800, height: 300, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Converte uma imagem guardada (WebP) para JPEG, o formato que o gerador de PDF
 * aceita. `maxSize` limita o lado maior, para o PDF não ficar pesado.
 */
export async function toPdfJpeg(input: Buffer, maxSize = 360): Promise<Buffer> {
  return sharp(input)
    .resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80 })
    .toBuffer();
}
