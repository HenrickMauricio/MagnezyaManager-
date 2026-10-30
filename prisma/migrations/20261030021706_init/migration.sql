-- CreateEnum
CREATE TYPE "RoleKey" AS ENUM ('ADMIN', 'VENDEDOR', 'CLIENTE');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('EMPRESA', 'PARTICULAR');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('ATIVO', 'INATIVO', 'DESCONTINUADO');

-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('POR_DIA', 'POR_EVENTO');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('ENTRADA', 'ABATE', 'AJUSTE');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('ABERTA', 'EM_CURSO', 'CONCLUIDA', 'ABATIDA');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('RASCUNHO', 'AGUARDANDO_APROVACAO', 'ENVIADO', 'APROVADO', 'REJEITADO', 'EXPIRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ApprovalChannel" AS ENUM ('INTERNO', 'PORTAL');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('RESERVADO', 'CONFLITO_STOCK', 'EM_PREPARACAO', 'ENTREGUE', 'EM_DEVOLUCAO', 'DEVOLVIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TaxRegion" AS ENUM ('CONTINENTE', 'ACORES', 'MADEIRA');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDENTE', 'ENVIADO', 'FALHOU');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "phone" TEXT,
    "roleId" TEXT NOT NULL,
    "clientId" TEXT,
    "maxDiscountBp" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" "RoleKey" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_permission_overrides" (
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("userId","permissionId")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "type" "ClientType" NOT NULL DEFAULT 'EMPRESA',
    "name" TEXT NOT NULL,
    "nif" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "billingAddress" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'PT',
    "notes" TEXT,
    "gdprConsentAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "prepBufferDays" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rateBp" INTEGER NOT NULL,
    "region" "TaxRegion" NOT NULL DEFAULT 'CONTINENTE',
    "exemptionCode" TEXT,
    "exemptionText" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'un',
    "priceCents" INTEGER NOT NULL,
    "priceUnit" "PriceUnit" NOT NULL DEFAULT 'POR_DIA',
    "taxRateId" TEXT NOT NULL,
    "stockBase" INTEGER NOT NULL DEFAULT 0,
    "status" "ArticleStatus" NOT NULL DEFAULT 'ATIVO',
    "internalNotes" TEXT,
    "lockVersion" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_images" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "userId" TEXT,
    "maintenanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenances" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'ABERTA',
    "startDate" DATE NOT NULL,
    "expectedEndDate" DATE,
    "endDate" DATE,
    "reason" TEXT NOT NULL,
    "costCents" INTEGER,
    "rentalId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "venue" TEXT,
    "address" TEXT,
    "city" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "additional_services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultPriceCents" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'serviço',
    "taxRateId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "additional_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'RASCUNHO',
    "deliveryDate" DATE NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "returnDate" DATE NOT NULL,
    "validUntil" DATE NOT NULL,
    "discountBp" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "internalNotes" TEXT,
    "terms" TEXT,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "servicesCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "lockVersion" INTEGER NOT NULL DEFAULT 0,
    "internalApprovedById" TEXT,
    "internalApprovedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedVia" "ApprovalChannel",
    "approvalIp" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "priceUnit" "PriceUnit" NOT NULL,
    "billableDays" INTEGER NOT NULL DEFAULT 1,
    "discountBp" INTEGER NOT NULL DEFAULT 0,
    "taxRateBp" INTEGER NOT NULL,
    "taxExemptionCode" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lineTotalCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_services" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "serviceId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "taxRateBp" INTEGER NOT NULL,
    "taxExemptionCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lineTotalCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_versions" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "pdfStorageKey" TEXT,
    "pdfSha256" TEXT,
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rentals" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "RentalStatus" NOT NULL DEFAULT 'RESERVADO',
    "deliveryDate" DATE NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "returnDate" DATE NOT NULL,
    "actualReturnDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_items" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantityReturned" INTEGER NOT NULL DEFAULT 0,
    "quantityDamaged" INTEGER NOT NULL DEFAULT 0,
    "blockFrom" DATE NOT NULL,
    "blockTo" DATE NOT NULL,

    CONSTRAINT "rental_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_returns" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "returnedAt" DATE NOT NULL,
    "receivedById" TEXT,
    "lines" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "nif" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Portugal',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "iban" TEXT,
    "logoKey" TEXT,
    "logoWhiteKey" TEXT,
    "quotePrefix" TEXT NOT NULL DEFAULT 'ORC',
    "rentalPrefix" TEXT NOT NULL DEFAULT 'RES',
    "quoteValidityDays" INTEGER NOT NULL DEFAULT 15,
    "defaultTerms" TEXT,
    "defaultTaxRateId" TEXT,
    "prepBufferDaysDefault" INTEGER NOT NULL DEFAULT 0,
    "emailFromName" TEXT,
    "emailFromAddress" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "key" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "quoteVersionId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDENTE',
    "providerId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE INDEX "users_clientId_idx" ON "users"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "clients_name_idx" ON "clients"("name");

-- CreateIndex
CREATE INDEX "clients_nif_idx" ON "clients"("nif");

-- CreateIndex
CREATE INDEX "client_contacts_clientId_idx" ON "client_contacts"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rates_name_region_key" ON "tax_rates"("name", "region");

-- CreateIndex
CREATE UNIQUE INDEX "articles_sku_key" ON "articles"("sku");

-- CreateIndex
CREATE INDEX "articles_categoryId_idx" ON "articles"("categoryId");

-- CreateIndex
CREATE INDEX "articles_name_idx" ON "articles"("name");

-- CreateIndex
CREATE INDEX "articles_status_idx" ON "articles"("status");

-- CreateIndex
CREATE INDEX "article_images_articleId_idx" ON "article_images"("articleId");

-- CreateIndex
CREATE INDEX "inventory_movements_articleId_effectiveDate_idx" ON "inventory_movements"("articleId", "effectiveDate");

-- CreateIndex
CREATE INDEX "maintenances_articleId_startDate_endDate_idx" ON "maintenances"("articleId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "maintenances_status_idx" ON "maintenances"("status");

-- CreateIndex
CREATE INDEX "events_clientId_idx" ON "events"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_number_key" ON "quotes"("number");

-- CreateIndex
CREATE INDEX "quotes_status_idx" ON "quotes"("status");

-- CreateIndex
CREATE INDEX "quotes_clientId_idx" ON "quotes"("clientId");

-- CreateIndex
CREATE INDEX "quotes_createdById_idx" ON "quotes"("createdById");

-- CreateIndex
CREATE INDEX "quotes_deliveryDate_returnDate_idx" ON "quotes"("deliveryDate", "returnDate");

-- CreateIndex
CREATE INDEX "quote_items_quoteId_idx" ON "quote_items"("quoteId");

-- CreateIndex
CREATE INDEX "quote_items_articleId_idx" ON "quote_items"("articleId");

-- CreateIndex
CREATE INDEX "quote_services_quoteId_idx" ON "quote_services"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_versions_quoteId_versionNumber_key" ON "quote_versions"("quoteId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "rentals_number_key" ON "rentals"("number");

-- CreateIndex
CREATE UNIQUE INDEX "rentals_quoteId_key" ON "rentals"("quoteId");

-- CreateIndex
CREATE INDEX "rentals_status_deliveryDate_returnDate_idx" ON "rentals"("status", "deliveryDate", "returnDate");

-- CreateIndex
CREATE INDEX "rentals_clientId_idx" ON "rentals"("clientId");

-- CreateIndex
CREATE INDEX "rental_items_articleId_blockFrom_blockTo_idx" ON "rental_items"("articleId", "blockFrom", "blockTo");

-- CreateIndex
CREATE INDEX "rental_items_rentalId_idx" ON "rental_items"("rentalId");

-- CreateIndex
CREATE INDEX "rental_returns_rentalId_idx" ON "rental_returns"("rentalId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "email_logs_quoteVersionId_idx" ON "email_logs"("quoteVersionId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_images" ADD CONSTRAINT "article_images_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "maintenances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "additional_services" ADD CONSTRAINT "additional_services_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_internalApprovedById_fkey" FOREIGN KEY ("internalApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_services" ADD CONSTRAINT "quote_services_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_services" ADD CONSTRAINT "quote_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "additional_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_items" ADD CONSTRAINT "rental_items_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_items" ADD CONSTRAINT "rental_items_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_returns" ADD CONSTRAINT "rental_returns_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_returns" ADD CONSTRAINT "rental_returns_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_defaultTaxRateId_fkey" FOREIGN KEY ("defaultTaxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "quote_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
