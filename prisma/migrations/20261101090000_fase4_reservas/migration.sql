-- DropForeignKey
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_quoteId_fkey";

-- AlterTable
ALTER TABLE "rental_items" ADD COLUMN     "prepBufferDays" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "rentals" ADD COLUMN     "actualDeliveryDate" DATE,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ALTER COLUMN "quoteId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

