/*
  Warnings:

  - You are about to drop the column `user_id` on the `Float_Ledger` table. All the data in the column will be lost.
  - Added the required column `account_id` to the `Float_Ledger` table without a default value. This is not possible if the table is not empty.
  - Added the required column `account_type` to the `Float_Ledger` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('COMPANY', 'TICKETER', 'POS_DEVICE');

-- DropForeignKey
ALTER TABLE "Float_Ledger" DROP CONSTRAINT "Float_Ledger_user_id_fkey";

-- AlterTable
ALTER TABLE "Float_Ledger" DROP COLUMN "user_id",
ADD COLUMN     "account_id" TEXT NOT NULL,
ADD COLUMN     "account_type" "AccountType" NOT NULL;
