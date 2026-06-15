/*
  Warnings:

  - Added the required column `report_day` to the `SalesReport` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SalesReport" ADD COLUMN     "report_day" DATE NOT NULL;
