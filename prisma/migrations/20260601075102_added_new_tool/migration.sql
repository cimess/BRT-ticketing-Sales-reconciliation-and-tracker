/*
  Warnings:

  - The values [DELETED] on the enum `TopUpStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TopUpStatus_new" AS ENUM ('AVAILABLE', 'USED', 'CANCELLED');
ALTER TABLE "public"."TopUp" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "TopUp" ALTER COLUMN "status" TYPE "TopUpStatus_new" USING ("status"::text::"TopUpStatus_new");
ALTER TYPE "TopUpStatus" RENAME TO "TopUpStatus_old";
ALTER TYPE "TopUpStatus_new" RENAME TO "TopUpStatus";
DROP TYPE "public"."TopUpStatus_old";
ALTER TABLE "TopUp" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
COMMIT;
