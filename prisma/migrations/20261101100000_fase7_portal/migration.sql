-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "approvedVersion" INTEGER,
ADD COLUMN     "rejectedById" TEXT,
ADD COLUMN     "rejectedVia" "ApprovalChannel",
ADD COLUMN     "rejectionIp" TEXT;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

