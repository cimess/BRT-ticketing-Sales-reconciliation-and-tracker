/*
  Warnings:

  - Added the required column `user_name` to the `SalesReport` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SalesReport" ADD COLUMN     "user_name" TEXT NOT NULL;
