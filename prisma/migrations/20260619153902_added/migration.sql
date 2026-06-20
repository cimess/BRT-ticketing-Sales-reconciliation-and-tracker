/*
  Warnings:

  - You are about to drop the column `user_name` on the `SalesReport` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,company_id]` on the table `Pos_devices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,company_id]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Pos_devices_name_key";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "SalesReport" DROP COLUMN "user_name";

-- CreateIndex
CREATE UNIQUE INDEX "Pos_devices_name_company_id_key" ON "Pos_devices"("name", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_company_id_key" ON "User"("email", "company_id");
