/*
  Warnings:

  - A unique constraint covering the columns `[user_id,assigned_for,session]` on the table `Ticketer_Location_Assignment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `created_by_id` to the `Ticketer_Location_Assignment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `session` to the `Ticketer_Location_Assignment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Time_Session" AS ENUM ('MORNING', 'EVENING');

-- DropIndex
DROP INDEX "Ticketer_Location_Assignment_location_id_assigned_for_key";

-- AlterTable
ALTER TABLE "Ticketer_Location_Assignment" ADD COLUMN     "created_by_id" TEXT NOT NULL,
ADD COLUMN     "session" "Time_Session" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Ticketer_Location_Assignment_user_id_assigned_for_session_key" ON "Ticketer_Location_Assignment"("user_id", "assigned_for", "session");

-- AddForeignKey
ALTER TABLE "Ticketer_Location_Assignment" ADD CONSTRAINT "Ticketer_Location_Assignment_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
