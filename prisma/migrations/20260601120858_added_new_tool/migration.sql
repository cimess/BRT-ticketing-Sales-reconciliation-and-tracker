/*
  Warnings:

  - Changed the type of `allocated_from` on the `TopUp` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TopUpSource" AS ENUM ('COMPANY_RESERVE', 'GOVERNMENT_TOP_UP', 'EXTERNAL_OTHER_SOURCE');

-- AlterTable
ALTER TABLE "TopUp" DROP COLUMN "allocated_from",
ADD COLUMN     "allocated_from" "TopUpSource" NOT NULL;
