/*
  Warnings:

  - Added the required column `scope` to the `Reconciliation_reports` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReconciliationScope" AS ENUM ('TICKETER', 'SUPERVISOR', 'ORG');

-- AlterTable
ALTER TABLE "Reconciliation_reports" ADD COLUMN     "scope" "ReconciliationScope" NOT NULL;
