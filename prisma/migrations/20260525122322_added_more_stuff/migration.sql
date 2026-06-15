/*
  Warnings:

  - You are about to drop the `TicketAssignment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TicketAssignment" DROP CONSTRAINT "TicketAssignment_location_id_fkey";

-- DropForeignKey
ALTER TABLE "TicketAssignment" DROP CONSTRAINT "TicketAssignment_user_id_fkey";

-- DropTable
DROP TABLE "TicketAssignment";

-- CreateTable
CREATE TABLE "Ticketer_Location_Assignment" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "assigned_for" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticketer_Location_Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticketer_Location_Assignment_location_id_assigned_for_key" ON "Ticketer_Location_Assignment"("location_id", "assigned_for");

-- AddForeignKey
ALTER TABLE "Ticketer_Location_Assignment" ADD CONSTRAINT "Ticketer_Location_Assignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticketer_Location_Assignment" ADD CONSTRAINT "Ticketer_Location_Assignment_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
