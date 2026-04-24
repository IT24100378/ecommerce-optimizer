const express = require('express');
const router = express.Router();
const { authenticateJwt, requireRole } = require('../middleware/auth');
const { syncProductStockMirror } = require('../services/inventoryService');

function parseNonNegativeInt(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function serverError(res, err) {
    console.error('[inventory] Route error:', err);
    return res.status(500).json({ error: 'Internal server error' });
}

// GET / - list all inventory records with product info
router.get('/', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    try {
        const inventory = await prisma.inventory.findMany({
            include: { product: true },
            orderBy: { id: 'asc' },
        });
        res.json(inventory);
    } catch (err) {
        return serverError(res, err);
    }
});

// GET /:id - get single inventory record
router.get('/:id', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    try {
        const record = await prisma.inventory.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { product: true },
        });
        if (!record) return res.status(404).json({ error: 'Inventory record not found' });
        res.json(record);
    } catch (err) {
        return serverError(res, err);
    }
});

// POST / - add inventory record (create only)
router.post('/', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    const { productId, stockLevel, lowStockThreshold } = req.body;
    const parsedProductId = Number.parseInt(productId, 10);
    const parsedStockLevel = stockLevel === undefined ? 0 : parseNonNegativeInt(stockLevel);
    const parsedLowStockThreshold = lowStockThreshold === undefined ? 10 : parseNonNegativeInt(lowStockThreshold);

    if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
        return res.status(400).json({ error: 'productId is required and must be a positive integer' });
    }
    if (parsedStockLevel === null) {
        return res.status(400).json({ error: 'stockLevel must be a non-negative integer' });
    }
    if (parsedLowStockThreshold === null) {
        return res.status(400).json({ error: 'lowStockThreshold must be a non-negative integer' });
    }

    try {
        const record = await prisma.$transaction(async (tx) => {
            const product = await tx.product.findUnique({ where: { id: parsedProductId } });
            if (!product) {
                const err = new Error('Product not found');
                err.code = 'PRODUCT_NOT_FOUND';
                throw err;
            }

            const created = await tx.inventory.create({
                data: {
                    productId: parsedProductId,
                    stockLevel: parsedStockLevel,
                    lowStockThreshold: parsedLowStockThreshold,
                },
                include: { product: true },
            });

            await syncProductStockMirror(tx, parsedProductId, created.stockLevel);
            return created;
        });
        res.status(201).json(record);
    } catch (err) {
        if (err.code === 'PRODUCT_NOT_FOUND') {
            return res.status(404).json({ error: 'Product not found' });
        }
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'Inventory record already exists for this product. Use Update instead.' });
        }
        return serverError(res, err);
    }
});

// PUT /:id - update stock level and/or threshold
router.put('/:id', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    const inventoryId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
        return res.status(400).json({ error: 'Invalid inventory id' });
    }

    const { stockLevel, lowStockThreshold } = req.body;
    const data = {};
    if (stockLevel !== undefined) {
        const parsedStockLevel = parseNonNegativeInt(stockLevel);
        if (parsedStockLevel === null) return res.status(400).json({ error: 'stockLevel must be a non-negative integer' });
        data.stockLevel = parsedStockLevel;
    }
    if (lowStockThreshold !== undefined) {
        const parsedLowStockThreshold = parseNonNegativeInt(lowStockThreshold);
        if (parsedLowStockThreshold === null) return res.status(400).json({ error: 'lowStockThreshold must be a non-negative integer' });
        data.lowStockThreshold = parsedLowStockThreshold;
    }

    if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'At least one field (stockLevel or lowStockThreshold) is required' });
    }

    try {
        const record = await prisma.$transaction(async (tx) => {
            const updated = await tx.inventory.update({
                where: { id: inventoryId },
                data,
                include: { product: true },
            });
            if (data.stockLevel !== undefined) {
                await syncProductStockMirror(tx, updated.productId, updated.stockLevel);
            }
            return updated;
        });
        res.json(record);
    } catch (err) {
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Inventory record not found' });
        }
        return serverError(res, err);
    }
});

// DELETE /:id - delete inventory record
router.delete('/:id', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    const inventoryId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
        return res.status(400).json({ error: 'Invalid inventory id' });
    }
    try {
        await prisma.$transaction(async (tx) => {
            const deleted = await tx.inventory.delete({ where: { id: inventoryId } });
            await syncProductStockMirror(tx, deleted.productId, 0);
        });
        res.json({ message: 'Inventory record deleted successfully' });
    } catch (err) {
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Inventory record not found' });
        }
        return serverError(res, err);
    }
});

module.exports = router;
