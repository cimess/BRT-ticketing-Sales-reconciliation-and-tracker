/*
  Warnings:

  - You are about to alter the column `percentage` on the `Commission_rules` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `DoublePrecision`.
  - A unique constraint covering the columns `[name]` on the table `Pos_devices` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Pos_devices` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Commission_rules" ALTER COLUMN "percentage" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Pos_devices" ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Pos_devices_name_key" ON "Pos_devices"("name");
