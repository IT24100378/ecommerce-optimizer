-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('EVENT', 'CATEGORY', 'PRODUCT');

-- AlterTable
ALTER TABLE "Promotion"
ADD COLUMN "type" "PromotionType" NOT NULL DEFAULT 'EVENT',
ADD COLUMN "categoryId" INTEGER,
ADD COLUMN "productId" INTEGER;

ALTER TABLE "Promotion"
ALTER COLUMN "promoCode" DROP NOT NULL;

-- Normalize legacy bad values before constraints are added
UPDATE "Promotion"
SET "discountPercentage" = ABS("discountPercentage")
WHERE "discountPercentage" < 0;

UPDATE "Promotion"
SET "discountPercentage" = 1
WHERE "discountPercentage" = 0;

UPDATE "Promotion"
SET "endDate" = "startDate"
WHERE "endDate" < "startDate";

-- Data quality constraints for promotion validity
ALTER TABLE "Promotion"
ADD CONSTRAINT "Promotion_discount_positive_chk" CHECK ("discountPercentage" > 0);

ALTER TABLE "Promotion"
ADD CONSTRAINT "Promotion_date_range_chk" CHECK ("endDate" >= "startDate");

-- CreateIndex
CREATE INDEX "Promotion_type_idx" ON "Promotion"("type");
CREATE INDEX "Promotion_categoryId_idx" ON "Promotion"("categoryId");
CREATE INDEX "Promotion_productId_idx" ON "Promotion"("productId");

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

