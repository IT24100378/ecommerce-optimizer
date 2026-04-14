-- CreateTable
CREATE TABLE "InventoryAdjustment" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "reason" TEXT NOT NULL,
    "change" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAdjustment_orderId_productId_reason_key" ON "InventoryAdjustment"("orderId", "productId", "reason");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_productId_createdAt_idx" ON "InventoryAdjustment"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_orderId_idx" ON "InventoryAdjustment"("orderId");

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

