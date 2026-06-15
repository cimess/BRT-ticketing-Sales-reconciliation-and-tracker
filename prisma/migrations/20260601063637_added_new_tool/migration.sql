-- CreateTable
CREATE TABLE "CompanyFloat" (
    "id" TEXT NOT NULL,
    "total_purchased" DECIMAL(18,2) NOT NULL,
    "total_allocated" DECIMAL(18,2) NOT NULL,
    "available_balance" DECIMAL(18,2) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyFloat_pkey" PRIMARY KEY ("id")
);
