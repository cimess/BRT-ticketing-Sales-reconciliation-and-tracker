/*
  Warnings:

  - You are about to drop the column `supervisor_id` on the `Float_allocations` table. All the data in the column will be lost.
  - You are about to drop the column `ticketer_id` on the `Float_allocations` table. All the data in the column will be lost.
  - Added the required column `from_user` to the `Float_allocations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `to_user` to the `Float_allocations` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TopUpStatus" AS ENUM ('AVAILABLE', 'USED');

-- DropForeignKey
ALTER TABLE "Float_allocations" DROP CONSTRAINT "Float_allocations_supervisor_id_fkey";

-- DropForeignKey
ALTER TABLE "Float_allocations" DROP CONSTRAINT "Float_allocations_ticketer_id_fkey";

-- AlterTable
ALTER TABLE "Float_allocations" DROP COLUMN "supervisor_id",
DROP COLUMN "ticketer_id",
ADD COLUMN     "from_user" TEXT NOT NULL,
ADD COLUMN     "to_user" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "TopUp" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "TopUpStatus" NOT NULL DEFAULT 'AVAILABLE',
    "allocated_from" TEXT NOT NULL,
    "date_received" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopUp_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Float_allocations" ADD CONSTRAINT "Float_allocations_from_user_fkey" FOREIGN KEY ("from_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Float_allocations" ADD CONSTRAINT "Float_allocations_to_user_fkey" FOREIGN KEY ("to_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
