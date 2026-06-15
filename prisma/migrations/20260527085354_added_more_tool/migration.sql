/*
  Warnings:

  - The values [FAILED] on the enum `Float_Status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Float_Status_new" AS ENUM ('SUCCESS', 'ADJUSTED', 'CANCELLED');
ALTER TABLE "public"."Float_allocations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Float_allocations" ALTER COLUMN "status" TYPE "Float_Status_new" USING ("status"::text::"Float_Status_new");
ALTER TYPE "Float_Status" RENAME TO "Float_Status_old";
ALTER TYPE "Float_Status_new" RENAME TO "Float_Status";
DROP TYPE "public"."Float_Status_old";
ALTER TABLE "Float_allocations" ALTER COLUMN "status" SET DEFAULT 'SUCCESS';
COMMIT;
