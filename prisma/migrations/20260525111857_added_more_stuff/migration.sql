/*
  Warnings:

  - You are about to drop the column `user_id` on the `Fine` table. All the data in the column will be lost.
  - You are about to drop the column `variance` on the `Remittance` table. All the data in the column will be lost.
  - Added the required column `defaulter_id` to the `Fine` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Fine" DROP CONSTRAINT "Fine_user_id_fkey";

-- AlterTable
ALTER TABLE "Fine" DROP COLUMN "user_id",
ADD COLUMN     "defaulter_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Remittance" DROP COLUMN "variance";

-- AddForeignKey
ALTER TABLE "Fine" ADD CONSTRAINT "Fine_defaulter_id_fkey" FOREIGN KEY ("defaulter_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
