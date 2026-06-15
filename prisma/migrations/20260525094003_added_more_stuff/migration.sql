/*
  Warnings:

  - Changed the type of `status` on the `Reconciliation_reports` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('MATCHED', 'VARIANCE', 'PENDING', 'INVESTIGATING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ExpectationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'OVERDUE', 'VIOLATED', 'PAID');

-- AlterTable
ALTER TABLE "Reconciliation_reports" DROP COLUMN "status",
ADD COLUMN     "status" "ReconciliationStatus" NOT NULL;

-- CreateTable
CREATE TABLE "RemittanceExpectation" (
    "id" TEXT NOT NULL,
    "ticketer_id" TEXT NOT NULL,
    "allocation_id" TEXT NOT NULL,
    "expected_amount" DOUBLE PRECISION NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "extended_due_date" TIMESTAMP(3),
    "status" "ExpectationStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemittanceExpectation_pkey" PRIMARY KEY ("id")
);
