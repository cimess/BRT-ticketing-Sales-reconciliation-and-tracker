/*
  Warnings:

  - Made the column `reference_id` on table `Float_Ledger` required. This step will fail if there are existing NULL values in that column.
  - Made the column `reference_type` on table `Float_Ledger` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Float_Ledger" ALTER COLUMN "reference_id" SET NOT NULL,
ALTER COLUMN "reference_type" SET NOT NULL;
