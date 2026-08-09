-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'TOPUP_BANK';

-- CreateTable
CREATE TABLE "TopUpBank" (
    "id" TEXT NOT NULL DEFAULT 'TOPUP_BANK',
    "company_id" TEXT NOT NULL,
    "available_balance" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "TopUpBank_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TopUpBank" ADD CONSTRAINT "TopUpBank_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
