/**
 * Marca da instalação (white-label). Cada empresa cliente tem a sua instalação;
 * a marca define-se por variáveis de ambiente no momento do build
 * (NEXT_PUBLIC_*, porque também é usada em componentes do browser).
 * Sem variáveis definidas, usa a marca de demonstração (Magnezya).
 *
 * Os dados legais (NIF, morada, IBAN…) e o logótipo para propostas ficam nas
 * Definições da empresa (base de dados), não aqui.
 */
const list = (value: string | undefined, fallback: string[]) =>
  value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : fallback;

export const BRAND = {
  /** Nome comercial, usado no título das páginas e nos textos. */
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Magnezya",
  /** Subtítulo do logótipo tipográfico. */
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE ?? "Event Support",
  /** Frase principal da página de login. */
  headline:
    process.env.NEXT_PUBLIC_BRAND_HEADLINE ?? "Mobiliário e equipamento que transformam cada evento.",
  /** Texto de apoio da página de login. */
  description:
    process.env.NEXT_PUBLIC_BRAND_DESCRIPTION ??
    "Soluções completas de aluguer para eventos corporate, feiras e congressos — do orçamento à montagem, com a disponibilidade sempre à vista.",
  /** Segmentos de mercado mostrados na página de login. */
  segments: list(process.env.NEXT_PUBLIC_BRAND_SEGMENTS, ["Corporate", "Feiras", "Congressos"]),
} as const;
