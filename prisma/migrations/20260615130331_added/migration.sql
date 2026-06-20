/*
  Warnings:

  - You are about to drop the column `ticketer_id` on the `RemittanceExpectation` table. All the data in the column will be lost.
  - Added the required column `user_id` to the `RemittanceExpectation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "RemittanceExpectation" DROP CONSTRAINT "RemittanceExpectation_allocation_id_fkey";

-- DropForeignKey
ALTER TABLE "RemittanceExpectation" DROP CONSTRAINT "RemittanceExpectation_ticketer_id_fkey";

-- AlterTable
ALTER TABLE "RemittanceExpectation" DROP COLUMN "ticketer_id",
ADD COLUMN     "shortage_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "source_remittance_id" TEXT,
ADD COLUMN     "user_id" TEXT NOT NULL,
ALTER COLUMN "allocation_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "RemittanceExpectation" ADD CONSTRAINT "RemittanceExpectation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceExpectation" ADD CONSTRAINT "RemittanceExpectation_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "Float_allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
