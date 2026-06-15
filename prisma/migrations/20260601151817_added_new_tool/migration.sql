/*
  Warnings:

  - Added the required column `posSession` to the `Float_Ledger` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Float_Ledger" ADD COLUMN     "posSession" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Float_Ledger" ADD CONSTRAINT "Float_Ledger_posSession_fkey" FOREIGN KEY ("posSession") REFERENCES "PosDeviceSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
