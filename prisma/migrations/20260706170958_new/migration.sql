/*
  Warnings:

  - You are about to drop the column `operator` on the `CompanyRule` table. All the data in the column will be lost.
  - You are about to drop the column `target_field` on the `CompanyRule` table. All the data in the column will be lost.
  - You are about to drop the column `trigger` on the `CompanyRule` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CompanyRule" DROP COLUMN "operator",
DROP COLUMN "target_field",
DROP COLUMN "trigger";
