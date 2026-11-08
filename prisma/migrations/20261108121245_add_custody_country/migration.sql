-- AlterTable
ALTER TABLE "Custody" ADD COLUMN "country" TEXT;

-- CreateIndex
CREATE INDEX "Custody_country_idx" ON "Custody"("country");
