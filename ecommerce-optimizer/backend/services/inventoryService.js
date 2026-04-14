function parsePositiveInt(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function ensureInventoryRecord(prisma, productId) {
    const parsedProductId = parsePositiveInt(productId);
    if (!parsedProductId) {
        throw new Error('Invalid productId for inventory operation');
    }

    const existing = await prisma.inventory.findUnique({ where: { productId: parsedProductId } });
    if (existing) return existing;

    const product = await prisma.product.findUnique({
        where: { id: parsedProductId },
        select: { id: true, stockQuantity: true },
    });
    if (!product) {
        throw new Error(`Product ${parsedProductId} not found`);
    }

    try {
        return await prisma.inventory.create({
            data: {
                productId: parsedProductId,
                stockLevel: Number.isInteger(product.stockQuantity) && product.stockQuantity >= 0 ? product.stockQuantity : 0,
                lowStockThreshold: 10,
            },
        });
    } catch (err) {
        if (err.code === 'P2002') {
            return prisma.inventory.findUnique({ where: { productId: parsedProductId } });
        }
        throw err;
    }
}

async function syncProductStockMirror(prisma, productId, stockLevel) {
    await prisma.product.update({
        where: { id: productId },
        data: { stockQuantity: stockLevel },
    });
}

async function adjustStock(prisma, params) {
    const {
        productId,
        delta,
        reason,
        orderId = null,
        allowNegative = false,
    } = params;

    const parsedProductId = parsePositiveInt(productId);
    const parsedOrderId = orderId === null || orderId === undefined ? null : parsePositiveInt(orderId);
    const parsedDelta = Number.parseInt(delta, 10);

    if (!parsedProductId || Number.isNaN(parsedDelta) || parsedDelta === 0 || !reason) {
        throw new Error('Invalid stock adjustment request');
    }

    const inventory = await ensureInventoryRecord(prisma, parsedProductId);

    if (parsedOrderId) {
        try {
            await prisma.inventoryAdjustment.create({
                data: {
                    productId: parsedProductId,
                    orderId: parsedOrderId,
                    reason,
                    change: parsedDelta,
                },
            });
        } catch (err) {
            if (err.code === 'P2002') {
                return prisma.inventory.findUnique({ where: { productId: parsedProductId } });
            }
            throw err;
        }
    }

    let updated;
    if (parsedDelta < 0) {
        const amountToDecrement = Math.abs(parsedDelta);
        const updateResult = await prisma.inventory.updateMany({
            where: {
                id: inventory.id,
                ...(allowNegative ? {} : { stockLevel: { gte: amountToDecrement } }),
            },
            data: { stockLevel: { decrement: amountToDecrement } },
        });
        if (updateResult.count === 0) {
            throw new Error(`Insufficient stock for product ${parsedProductId}`);
        }
        updated = await prisma.inventory.findUnique({ where: { id: inventory.id } });
    } else {
        updated = await prisma.inventory.update({
            where: { id: inventory.id },
            data: { stockLevel: { increment: parsedDelta } },
        });
    }

    if (!parsedOrderId) {
        await prisma.inventoryAdjustment.create({
            data: {
                productId: parsedProductId,
                reason,
                change: parsedDelta,
            },
        });
    }

    await syncProductStockMirror(prisma, parsedProductId, updated.stockLevel);
    return updated;
}

function mapProductWithInventory(product) {
    const stockLevel = product?.inventory?.stockLevel ?? product?.stockQuantity ?? 0;
    return {
        ...product,
        stockQuantity: stockLevel,
        availableStock: stockLevel,
        stockStatus: stockLevel > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
    };
}

module.exports = {
    ensureInventoryRecord,
    syncProductStockMirror,
    adjustStock,
    mapProductWithInventory,
};

