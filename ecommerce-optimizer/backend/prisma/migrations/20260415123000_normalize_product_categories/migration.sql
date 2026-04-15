-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- Seed categories from existing product values
INSERT INTO "Category" ("name")
SELECT DISTINCT TRIM("category")
FROM "Product"
WHERE "category" IS NOT NULL
  AND TRIM("category") <> '';

-- Add normalized category relation on Product
ALTER TABLE "Product" ADD COLUMN "categoryId" INTEGER;

-- Backfill categoryId from existing category names
UPDATE "Product" p
SET "categoryId" = c."id"
FROM "Category" c
WHERE TRIM(p."category") = c."name";

-- Ensure there is a fallback category for inconsistent historical data
INSERT INTO "Category" ("name")
SELECT 'Uncategorized'
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Uncategorized');

UPDATE "Product"
SET "categoryId" = (SELECT "id" FROM "Category" WHERE "name" = 'Uncategorized')
WHERE "categoryId" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "categoryId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove denormalized category text column
ALTER TABLE "Product" DROP COLUMN "category";

