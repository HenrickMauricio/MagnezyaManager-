/**
 * Gera prisma/data/catalogo-magnezya.json a partir da loja pública magnezya.pt
 * (WooCommerce Store API). Uso autorizado pela Magnezya para este projeto.
 *
 *   npx tsx scripts/catalogo-magnezya.ts
 *
 * O ficheiro gerado fica no repositório: o seed funciona sem acesso à internet.
 * Peças individuais → artigos (uma categoria por tipo).
 * Conjuntos/sets → guardados à parte, para a futura funcionalidade de kits.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { CATALOG_CATEGORIES, type CatalogData, type CatalogItem } from "../prisma/data/catalog-types";

const API = "https://magnezya.pt/wp-json/wc/store/v1/products";
const MAX_IMAGES = 3;

type WooProduct = {
  id: number;
  name: string;
  permalink: string;
  short_description: string;
  description: string;
  categories: { name: string }[];
  images: { src: string }[];
};

/** Categorias da loja que significam "conjunto de várias peças". */
const SET_CATEGORIES = new Set([
  "Conjuntos",
  "Sets",
  "Poltronas e Mesas Baixas",
  "Mesas e Cadeiras",
  "Mesas e Bancos Altos",
  "Sofás, Poltronas e Mesa Baixas",
  "Sofás e Poltronas",
]);

/** Categoria da loja → prefixo da nossa categoria (a primeira que coincidir ganha). */
const CATEGORY_RULES: [string[], string][] = [
  [["Cadeiras"], "CAD"],
  [["Bancos Altos", "Bancos"], "BAN"],
  [["Mesas Altas", "Mesas Baixas", "Mesas"], "MES"],
  [["Sofás", "Poltronas"], "SOF"],
  [["Puffs"], "PUF"],
  [["Balcões Iluminados", "Balcões", "Pack Bar"], "BAL"],
  [["Mobiliário Paletes", "Paletes"], "PAL"],
  [["Texteis"], "TEX"],
  [["Mobiliário Iluminado", "Decoração"], "DEC"],
  [["Truss", "Estrados", "Estruturas"], "EST"],
  [["Postes/Baias/Barreiras", "Bengaleiro"], "BAR"],
  [["Apoio", "Audiovisuais", "Climatização", "Tendas", "Lounge"], "DIV"],
];

/** Quando a loja não indica o tipo, usa o nome. */
const NAME_RULES: [RegExp, string][] = [
  [/^puff/i, "PUF"],
  [/cadeira/i, "CAD"],
  [/banco|banqueta/i, "BAN"],
  [/mesa/i, "MES"],
  [/sof[aá]|poltrona|chaise/i, "SOF"],
  [/balc[aã]o|bar\b/i, "BAL"],
  [/tapete|toalha|camilha|rodap[eé]|lycra/i, "TEX"],
  [/candeeiro|led|vaso|espelho|cubo|esfera|cilindro/i, "DEC"],
  [/truss|estrado|palco|estrutura/i, "EST"],
  [/poste|cord[aã]o|barreira|baia|bengaleiro/i, "BAR"],
];

const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&[a-z]+;/g, " ");

function plainText(html: string, name: string): string | null {
  const text = decodeEntities(
    html
      .replace(/\[\/?[a-z_]+[^\]]*\]/gi, " ") // shortcodes do WPBakery ([vc_row] …)
      .replace(/<\/p>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && l.toLowerCase() !== name.toLowerCase())
    .join("\n")
    .trim();
  return text ? text.slice(0, 2000) : null;
}

function classify(p: WooProduct): { kind: "item"; prefix: string } | { kind: "set" } {
  const names = p.categories.map((c) => decodeEntities(c.name));
  const onlySetCategories = names.length > 0 && names.every((n) => SET_CATEGORIES.has(n));
  const namedAsSet = names.some((n) => n === "Conjuntos" || n === "Sets") && /\s(e|c\/?)\s|,/i.test(p.name);
  if (onlySetCategories || namedAsSet) return { kind: "set" };

  for (const [categories, prefix] of CATEGORY_RULES) {
    if (prefix !== "PUF" && /^puff/i.test(p.name)) return { kind: "item", prefix: "PUF" };
    if (categories.some((c) => names.includes(c))) return { kind: "item", prefix };
  }
  for (const [pattern, prefix] of NAME_RULES) if (pattern.test(p.name)) return { kind: "item", prefix };
  return { kind: "item", prefix: "DIV" };
}

function images(p: WooProduct): string[] {
  return [...new Set(p.images.map((i) => i.src))].slice(0, MAX_IMAGES);
}

async function fetchAll(): Promise<WooProduct[]> {
  const all: WooProduct[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${API}?per_page=100&page=${page}`);
    if (!res.ok) throw new Error(`Store API ${res.status} na página ${page}`);
    const batch = (await res.json()) as WooProduct[];
    all.push(...batch);
    const totalPages = Number(res.headers.get("x-wp-totalpages") ?? 1);
    if (page >= totalPages) return all;
  }
}

async function main() {
  const products = await fetchAll();
  const items: CatalogItem[] = [];
  const sets: CatalogData["sets"] = [];

  for (const p of products) {
    const name = decodeEntities(p.name).replace(/\s+/g, " ").trim();
    const result = classify(p);
    if (result.kind === "set") {
      sets.push({ sourceId: p.id, name, url: p.permalink, images: images(p) });
      continue;
    }
    items.push({
      sourceId: p.id,
      sku: `${result.prefix}-${p.id}`,
      name,
      category: result.prefix,
      description: plainText(p.short_description || p.description, name),
      url: p.permalink,
      images: images(p),
    });
  }

  items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, "pt"));
  sets.sort((a, b) => a.name.localeCompare(b.name, "pt"));

  const data: CatalogData = {
    source: "https://magnezya.pt (WooCommerce Store API)",
    generatedAt: new Date().toISOString().slice(0, 10),
    items,
    sets,
  };
  const file = path.join(import.meta.dirname, "..", "prisma", "data", "catalogo-magnezya.json");
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");

  const byCategory = Object.fromEntries(
    CATALOG_CATEGORIES.map((c) => [c.prefix, items.filter((i) => i.category === c.prefix).length]),
  );
  console.log(`Produtos lidos: ${products.length} · artigos: ${items.length} · conjuntos: ${sets.length}`);
  console.log("Artigos por categoria:", byCategory);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
