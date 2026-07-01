/*
  Warnings:

  - You are about to drop the column `allocation_id` on the `Remittance` table. All the data in the column will be lost.
  - You are about to drop the column `allocation_id` on the `RemittanceExpectation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[pos_session_id]` on the table `RemittanceExpectation` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Remittance" DROP CONSTRAINT "Remittance_allocation_id_fkey";

-- DropForeignKey
ALTER TABLE "RemittanceExpectation" DROP CONSTRAINT "RemittanceExpectation_allocation_id_fkey";

-- DropIndex
DROP INDEX "RemittanceExpectation_allocation_id_key";

-- AlterTable
ALTER TABLE "Remittance" DROP COLUMN "allocation_id",
ADD COLUMN     "pos_session_id" TEXT;

-- AlterTable
ALTER TABLE "RemittanceExpectation" DROP COLUMN "allocation_id",
ADD COLUMN     "pos_session_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RemittanceExpectation_pos_session_id_key" ON "RemittanceExpectation"("pos_session_id");

-- AddForeignKey
ALTER TABLE "Remittance" ADD CONSTRAINT "Remittance_pos_session_id_fkey" FOREIGN KEY ("pos_session_id") REFERENCES "PosDeviceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceExpectation" ADD CONSTRAINT "RemittanceExpectation_pos_session_id_fkey" FOREIGN KEY ("pos_session_id") REFERENCES "PosDeviceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
