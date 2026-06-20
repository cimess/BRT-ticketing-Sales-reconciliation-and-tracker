-- AddForeignKey
ALTER TABLE "RemittanceExpectation" ADD CONSTRAINT "RemittanceExpectation_ticketer_id_fkey" FOREIGN KEY ("ticketer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceExpectation" ADD CONSTRAINT "RemittanceExpectation_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "Float_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
