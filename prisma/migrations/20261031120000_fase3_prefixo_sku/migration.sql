-- Prefixo de SKU por categoria (Fase 3).
ALTER TABLE "categories" ADD COLUMN "skuPrefix" TEXT;

-- Categorias existentes: prefixos usados nos SKUs do catálogo de demonstração;
-- outras recebem as 3 primeiras letras do slug.
UPDATE "categories" SET "skuPrefix" = CASE "slug"
  WHEN 'cadeiras' THEN 'CAD'
  WHEN 'mesas' THEN 'MES'
  WHEN 'sofas-e-poltronas' THEN 'SOF'
  WHEN 'bancos-e-banquetas' THEN 'BAN'
  WHEN 'balcoes-e-bares' THEN 'BAL'
  WHEN 'iluminacao-e-decoracao' THEN 'DEC'
  WHEN 'palcos-e-estruturas' THEN 'EST'
  WHEN 'exterior-e-diversos' THEN 'DIV'
  ELSE upper(left(regexp_replace("slug", '[^a-z]', '', 'g'), 3))
END;

ALTER TABLE "categories" ALTER COLUMN "skuPrefix" SET NOT NULL;

CREATE UNIQUE INDEX "categories_skuPrefix_key" ON "categories"("skuPrefix");
