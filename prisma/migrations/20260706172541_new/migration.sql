/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `CompanyRule` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CompanyRule_name_key" ON "CompanyRule"("name");
