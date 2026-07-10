-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('MONTHLY_SALES', 'MONTHLY_FLOAT', 'LOCATION_SALES');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'RUNNING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'PDF');

-- CreateTable
CREATE TABLE "ReportTask" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "format" "ExportFormat" NOT NULL DEFAULT 'CSV',
    "storage_key" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "ReportTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportTask_company_id_status_idx" ON "ReportTask"("company_id", "status");

-- AddForeignKey
ALTER TABLE "ReportTask" ADD CONSTRAINT "ReportTask_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportTask" ADD CONSTRAINT "ReportTask_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
