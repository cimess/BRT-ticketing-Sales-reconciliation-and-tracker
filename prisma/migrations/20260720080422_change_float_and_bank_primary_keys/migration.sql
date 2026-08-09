/*
  Warnings:

  - The primary key for the `CompanyFloat` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `TopUpBank` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "CompanyFloat" DROP CONSTRAINT "CompanyFloat_pkey",
ADD CONSTRAINT "CompanyFloat_pkey" PRIMARY KEY ("company_id");

-- AlterTable
ALTER TABLE "TopUpBank" DROP CONSTRAINT "TopUpBank_pkey",
ADD CONSTRAINT "TopUpBank_pkey" PRIMARY KEY ("company_id");
