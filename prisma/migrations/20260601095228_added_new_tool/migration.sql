/*
  Warnings:

  - You are about to drop the column `top_up` on the `SalesReport` table. All the data in the column will be lost.
  - You are about to drop the `CompanyFloat` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `pos_float` to the `PosDeviceSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PosDeviceSession" ADD COLUMN     "pos_float" DECIMAL(18,2) NOT NULL;

-- AlterTable
ALTER TABLE "SalesReport" DROP COLUMN "top_up";

-- DropTable
DROP TABLE "CompanyFloat";
