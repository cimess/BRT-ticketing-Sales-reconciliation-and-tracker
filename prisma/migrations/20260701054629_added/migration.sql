/*
  Warnings:

  - Changed the type of `amount` on the `Fine` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "FineAmountType" AS ENUM ('FLOAT', 'NULL');

-- AlterTable
ALTER TABLE "Fine" DROP COLUMN "amount",
ADD COLUMN     "amount" "FineAmountType" NOT NULL;
