-- DropForeignKey
ALTER TABLE "Float_Ledger" DROP CONSTRAINT "Float_Ledger_posSession_fkey";

-- AlterTable
ALTER TABLE "Float_Ledger" ALTER COLUMN "posSession" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Float_Ledger" ADD CONSTRAINT "Float_Ledger_posSession_fkey" FOREIGN KEY ("posSession") REFERENCES "PosDeviceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
