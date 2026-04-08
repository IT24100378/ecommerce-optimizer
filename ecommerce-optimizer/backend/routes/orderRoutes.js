const express = require('express');
const router = express.Router();
const { authenticateJwt, requireRole } = require('../middleware/auth');

function parseId(value) {
    const id = Number.parseInt(value, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function serverError(res, err) {
    console.error('[orders] Route error:', err);
    return res.status(500).json({ error: 'Internal server error' });
}

// GET / - list all orders with user and items (include product info on items)
router.get('/', authenticateJwt, async (req, res) => {
    const prisma = req.app.locals.prisma;
    try {
        const where = req.user.role === 'ADMIN' || req.user.role === 'VENDOR'
            ? {}
            : { userId: req.user.id };
        const orders = await prisma.order.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true } },
                items: { include: { product: true } },
            },
            orderBy: { orderDate: 'desc' },
        });
        return res.json(orders);
    } catch (err) {
        return serverError(res, err);
    }
});

// GET /:id - get single order
router.get('/:id', authenticateJwt, async (req, res) => {
    const prisma = req.app.locals.prisma;
    const orderId = parseId(req.params.id);
    if (!orderId) {
        return res.status(400).json({ error: 'Invalid order id' });
    }
    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: { select: { id: true, name: true, email: true } },
                items: { include: { product: true } },
            },
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (req.user.role !== 'ADMIN' && req.user.role !== 'VENDOR' && order.userId !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        return res.json(order);
    } catch (err) {
        return serverError(res, err);
    }
});

// POST / - create order with items array [{productId, quantity, price}]
router.post('/', authenticateJwt, async (req, res) => {
    const prisma = req.app.locals.prisma;
    const { items, status, discountedTotal } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'items array is required' });
    }
    const subtotalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const normalizedDiscountedTotal = discountedTotal === undefined || discountedTotal === null
        ? null
        : parseFloat(discountedTotal);
    if (normalizedDiscountedTotal !== null && (Number.isNaN(normalizedDiscountedTotal) || normalizedDiscountedTotal < 0 || normalizedDiscountedTotal > subtotalAmount)) {
        return res.status(400).json({ error: 'discountedTotal must be a valid amount between 0 and subtotal' });
    }
    try {
        const parsedItems = items.map(item => ({
            productId: parseInt(item.productId),
            quantity: parseInt(item.quantity),
            price: parseFloat(item.price),
        }));
        if (parsedItems.some(item => Number.isNaN(item.productId) || Number.isNaN(item.quantity) || Number.isNaN(item.price) || item.quantity <= 0 || item.price < 0)) {
            return res.status(400).json({ error: 'Each item must include valid productId, quantity (>0), and price (>=0)' });
        }

        const productQuantityMap = parsedItems.reduce((productQuantities, item) => {
            productQuantities.set(item.productId, (productQuantities.get(item.productId) || 0) + item.quantity);
            return productQuantities;
        }, new Map());

        const order = await prisma.$transaction(async (tx) => {
            const productIds = [...productQuantityMap.keys()];
            const products = await tx.product.findMany({
                where: { id: { in: productIds }, isActive: true },
                select: { id: true, stockQuantity: true },
            });
            if (products.length !== productIds.length) {
                const availableIds = new Set(products.map(product => product.id));
                const unavailableIds = productIds.filter(id => !availableIds.has(id));
                throw new Error(`One or more products are unavailable: ${unavailableIds.join(', ')}`);
            }
            const productMap = new Map(products.map(product => [product.id, product]));
            for (const [productId, quantity] of productQuantityMap.entries()) {
                const product = productMap.get(productId);
                if (!product || product.stockQuantity < quantity) {
                    throw new Error(`Insufficient stock for product ${productId}`);
                }
            }

            for (const [productId, quantity] of productQuantityMap.entries()) {
                await tx.product.update({
                    where: { id: productId },
                    data: { stockQuantity: { decrement: quantity } },
                });
            }

            return tx.order.create({
                data: {
                    userId: req.user.id,
                    totalAmount: subtotalAmount,
                    discountedTotal: normalizedDiscountedTotal,
                    status: status || 'PENDING',
                    items: {
                        create: parsedItems,
                    },
                },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    items: { include: { product: true } },
                },
            });
        });
        res.status(201).json(order);
    } catch (err) {
        if (err.message && (err.message.includes('Insufficient stock') || err.message.includes('unavailable'))) {
            return res.status(400).json({ error: err.message });
        }
        return serverError(res, err);
    }
});

// PUT /:id - update order status
router.put('/:id', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    const { status } = req.body;
    const orderId = parseId(req.params.id);
    if (!orderId) {
        return res.status(400).json({ error: 'Invalid order id' });
    }
    try {
        const order = await prisma.order.update({
            where: { id: orderId },
            data: { status },
            include: {
                user: { select: { id: true, name: true, email: true } },
                items: { include: { product: true } },
            },
        });
        return res.json(order);
    } catch (err) {
        return serverError(res, err);
    }
});

// DELETE /:id - delete order (hard delete)
router.delete('/:id', authenticateJwt, requireRole('ADMIN'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    const orderId = parseId(req.params.id);
    if (!orderId) {
        return res.status(400).json({ error: 'Invalid order id' });
    }
    try {
        await prisma.orderItem.deleteMany({ where: { orderId } });
        await prisma.order.delete({ where: { id: orderId } });
        return res.json({ message: 'Order deleted successfully' });
    } catch (err) {
        return serverError(res, err);
    }
});

module.exports = router;
