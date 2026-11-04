/*
  Warnings:

  - A unique constraint covering the columns `[merchantInvoiceNumber]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `merchantInvoiceNumber` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "getWayResponse" JSONB,
ADD COLUMN     "merchantInvoiceNumber" TEXT NOT NULL,
ADD COLUMN     "payerReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_merchantInvoiceNumber_key" ON "payments"("merchantInvoiceNumber");
