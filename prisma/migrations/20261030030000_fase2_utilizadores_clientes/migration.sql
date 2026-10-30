-- DropIndex
DROP INDEX "clients_nif_idx";

-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "nif" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "clients_nif_key" ON "clients"("nif");

