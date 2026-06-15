/*
  Warnings:

  - You are about to drop the column `session_id` on the `SalesReport` table. All the data in the column will be lost.
  - Added the required column `pos_session_id` to the `SalesReport` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SalesReport" DROP CONSTRAINT "SalesReport_session_id_fkey";

-- AlterTable
ALTER TABLE "SalesReport" DROP COLUMN "session_id",
ADD COLUMN     "pos_session_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "SalesReport" ADD CONSTRAINT "SalesReport_pos_session_id_fkey" FOREIGN KEY ("pos_session_id") REFERENCES "PosDeviceSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
