-- CreateEnum
CREATE TYPE "SalesReportStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "SalesReport" ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "status" "SalesReportStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by" TEXT;
