-- CreateTable
CREATE TABLE "CompanyRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" TEXT NOT NULL,
    "target_field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "comparison_value" DOUBLE PRECISION NOT NULL,
    "fine_amount" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company_id" TEXT NOT NULL,

    CONSTRAINT "CompanyRule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CompanyRule" ADD CONSTRAINT "CompanyRule_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
