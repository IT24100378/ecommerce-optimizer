const express = require('express');
const router = express.Router();
const { authenticateJwt, requireRole } = require('../middleware/auth');

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

// POST / - add inventory record
router.post('/', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    const { productId, stockLevel, lowStockThreshold } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId is required' });
    try {
        const record = await prisma.inventory.create({
            data: {
                productId: parseInt(productId),
                stockLevel: stockLevel !== undefined ? parseInt(stockLevel) : 0,
                lowStockThreshold: lowStockThreshold !== undefined ? parseInt(lowStockThreshold) : 10,
            },
            include: { product: true },
        });
        res.status(201).json(record);
    } catch (err) {
        return serverError(res, err);
    }
});

// PUT /:id - update stock level and/or threshold
router.put('/:id', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    const { stockLevel, lowStockThreshold } = req.body;
    const data = {};
    if (stockLevel !== undefined) data.stockLevel = parseInt(stockLevel);
    if (lowStockThreshold !== undefined) data.lowStockThreshold = parseInt(lowStockThreshold);
    try {
        const record = await prisma.inventory.update({
            where: { id: parseInt(req.params.id) },
            data,
            include: { product: true },
        });
        res.json(record);
    } catch (err) {
        return serverError(res, err);
    }
});

// DELETE /:id - delete inventory record
router.delete('/:id', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    try {
        await prisma.inventory.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Inventory record deleted successfully' });
    } catch (err) {
        return serverError(res, err);
    }
});

module.exports = router;
