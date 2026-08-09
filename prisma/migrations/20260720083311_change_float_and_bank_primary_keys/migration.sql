/*
  Warnings:

  - A unique constraint covering the columns `[name,company_id]` on the table `CompanyRule` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "CompanyRule_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "CompanyRule_name_company_id_key" ON "CompanyRule"("name", "company_id");
