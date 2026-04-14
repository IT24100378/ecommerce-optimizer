-- Recovered migration folder to match database migration history.
-- This SQL mirrors the profile/stock/discount schema changes already present in the project.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "stockQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "discountedTotal" DOUBLE PRECISION;

