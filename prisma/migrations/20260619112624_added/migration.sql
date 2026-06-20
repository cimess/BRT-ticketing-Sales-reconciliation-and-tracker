/*
  Warnings:

  - Added the required column `company_id` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `CommissionEarning` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Commission_rules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `CompanyFloat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Fine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Float_Ledger` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Float_allocations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Location` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `PosDeviceSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Pos_devices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Reconciliation_reports` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `RegistrationToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Remittance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `RemittanceExpectation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `SalesReport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Ticketer_Location_Assignment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `TopUp` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CommissionEarning" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Commission_rules" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CompanyFloat" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Fine" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Float_Ledger" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Float_allocations" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PosDeviceSession" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Pos_devices" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Reconciliation_reports" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "RegistrationToken" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Remittance" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "RemittanceExpectation" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SalesReport" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Ticketer_Location_Assignment" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TopUp" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "company_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationToken" ADD CONSTRAINT "RegistrationToken_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopUp" ADD CONSTRAINT "TopUp_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyFloat" ADD CONSTRAINT "CompanyFloat_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Float_allocations" ADD CONSTRAINT "Float_allocations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remittance" ADD CONSTRAINT "Remittance_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation_reports" ADD CONSTRAINT "Reconciliation_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceExpectation" ADD CONSTRAINT "RemittanceExpectation_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Float_Ledger" ADD CONSTRAINT "Float_Ledger_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pos_devices" ADD CONSTRAINT "Pos_devices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosDeviceSession" ADD CONSTRAINT "PosDeviceSession_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReport" ADD CONSTRAINT "SalesReport_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission_rules" ADD CONSTRAINT "Commission_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEarning" ADD CONSTRAINT "CommissionEarning_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fine" ADD CONSTRAINT "Fine_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticketer_Location_Assignment" ADD CONSTRAINT "Ticketer_Location_Assignment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
