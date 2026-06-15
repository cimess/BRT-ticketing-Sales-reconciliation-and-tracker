-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'SUPERVISOR';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Remittance" ADD COLUMN     "received_by_supervisor_id" TEXT;

-- AddForeignKey
ALTER TABLE "Remittance" ADD CONSTRAINT "Remittance_received_by_supervisor_id_fkey" FOREIGN KEY ("received_by_supervisor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
