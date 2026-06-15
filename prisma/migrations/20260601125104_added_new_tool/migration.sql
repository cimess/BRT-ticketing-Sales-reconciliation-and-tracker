/*
  Warnings:

  - You are about to drop the column `to_user` on the `Float_allocations` table. All the data in the column will be lost.
  - Added the required column `pos_device_id` to the `Float_allocations` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Float_allocations" DROP CONSTRAINT "Float_allocations_to_user_fkey";

-- AlterTable
ALTER TABLE "Float_allocations" DROP COLUMN "to_user",
ADD COLUMN     "pos_device_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Float_allocations" ADD CONSTRAINT "Float_allocations_pos_device_id_fkey" FOREIGN KEY ("pos_device_id") REFERENCES "PosDeviceSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
