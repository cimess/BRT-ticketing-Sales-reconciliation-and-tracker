/*
  Warnings:

  - Added the required column `closing_balance` to the `SalesReport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `opening_balance` to the `SalesReport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `top_up` to the `SalesReport` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SalesReport" ADD COLUMN     "closing_balance" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "opening_balance" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "top_up" DOUBLE PRECISION NOT NULL;
