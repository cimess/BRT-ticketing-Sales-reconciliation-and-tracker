/*
  Warnings:

  - Changed the type of `action` on the `AuditLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `entity_type` on the `AuditLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'VERIFY');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('TOPUP', 'FLOAT_ALLOCATION', 'REMITTANCE', 'USER', 'FINE');

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "action",
ADD COLUMN     "action" "AuditAction" NOT NULL,
DROP COLUMN "entity_type",
ADD COLUMN     "entity_type" "AuditEntityType" NOT NULL;
