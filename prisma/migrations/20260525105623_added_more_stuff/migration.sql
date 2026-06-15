/*
  Warnings:

  - You are about to drop the column `ticketer_id` on the `Remittance` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `Remittance` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - Added the required column `submitted_by` to the `Remittance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `variance` to the `Remittance` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Remittance" DROP CONSTRAINT "Remittance_ticketer_id_fkey";

-- AlterTable
ALTER TABLE "Remittance" DROP COLUMN "ticketer_id",
ADD COLUMN     "submitted_by" TEXT NOT NULL,
ADD COLUMN     "variance" DECIMAL(18,2) NOT NULL,
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2);

-- AddForeignKey
ALTER TABLE "Remittance" ADD CONSTRAINT "Remittance_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
