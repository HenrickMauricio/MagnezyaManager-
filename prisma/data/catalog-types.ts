/**
 * Formato do catálogo de demonstração (prisma/data/catalogo-magnezya.json)
 * e as categorias para onde os artigos são mapeados.
 */

export type CatalogItem = {
  /** Id do produto na loja de origem (estável entre importações). */
  sourceId: number;
  sku: string;
  name: string;
  /** Prefixo da categoria (ver CATALOG_CATEGORIES). */
  category: string;
  description: string | null;
  url: string;
  images: string[];
};

export type CatalogSet = { sourceId: number; name: string; url: string; images: string[] };

export type CatalogData = {
  source: string;
  generatedAt: string;
  items: CatalogItem[];
  /** Conjuntos de várias peças: reservados para a futura funcionalidade de kits. */
  sets: CatalogSet[];
};

/**
 * Categorias do catálogo de demonstração, pela ordem de apresentação.
 * `stock` e `price` (€/dia) são intervalos para valores FICTÍCIOS.
 */
export const CATALOG_CATEGORIES = [
  { prefix: "CAD", name: "Cadeiras", buffer: 0, stock: [40, 400], price: [1.5, 6] },
  { prefix: "BAN", name: "Bancos e bancos altos", buffer: 0, stock: [20, 120], price: [4, 12] },
  { prefix: "MES", name: "Mesas", buffer: 0, stock: [10, 80], price: [6, 25] },
  { prefix: "SOF", name: "Sofás e poltronas", buffer: 1, stock: [4, 24], price: [35, 110] },
  { prefix: "PUF", name: "Puffs", buffer: 0, stock: [10, 60], price: [6, 20] },
  { prefix: "BAL", name: "Balcões e bares", buffer: 1, stock: [2, 12], price: [60, 150] },
  { prefix: "PAL", name: "Mobiliário de paletes", buffer: 1, stock: [4, 30], price: [15, 60] },
  { prefix: "DEC", name: "Iluminação e decoração", buffer: 0, stock: [4, 40], price: [8, 45] },
  { prefix: "TEX", name: "Têxteis", buffer: 1, stock: [20, 200], price: [3, 12] },
  { prefix: "EST", name: "Estruturas, palcos e truss", buffer: 1, stock: [6, 60], price: [15, 90] },
  { prefix: "BAR", name: "Barreiras e bengaleiros", buffer: 0, stock: [10, 80], price: [4, 15] },
  { prefix: "DIV", name: "Equipamento e diversos", buffer: 0, stock: [2, 20], price: [10, 120] },
] as const;
