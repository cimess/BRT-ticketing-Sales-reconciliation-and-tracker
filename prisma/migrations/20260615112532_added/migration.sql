-- AlterTable
ALTER TABLE "Remittance" ADD COLUMN     "allocation_id" TEXT;

-- AddForeignKey
ALTER TABLE "Remittance" ADD CONSTRAINT "Remittance_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "Float_allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
