const express = require('express');
const router = express.Router();
const { authenticateJwt, requireRole } = require('../middleware/auth');
const { adjustStock, ensureInventoryRecord } = require('../services/inventoryService');

const RESTOCK_STATUSES = new Set(['CANCELLED', 'RETURNED']);

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
                select: { id: true },
            });
            if (products.length !== productIds.length) {
                const availableIds = new Set(products.map(product => product.id));
                const unavailableIds = productIds.filter(id => !availableIds.has(id));
                throw new Error(`One or more products are unavailable: ${unavailableIds.join(', ')}`);
            }
            for (const productId of productIds) {
                // Ensure existing catalog items always have inventory records for stock ownership.
                await ensureInventoryRecord(tx, productId);
            }

            const createdOrder = await tx.order.create({
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

            for (const [productId, quantity] of productQuantityMap.entries()) {
                await adjustStock(tx, {
                    productId,
                    delta: -quantity,
                    reason: 'ORDER_PLACED',
                    orderId: createdOrder.id,
                });
            }

            return createdOrder;
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
    const nextStatusRaw = req.body.status;
    const status = typeof nextStatusRaw === 'string' ? nextStatusRaw.toUpperCase() : '';
    const orderId = parseId(req.params.id);
    if (!orderId) {
        return res.status(400).json({ error: 'Invalid order id' });
    }
    if (!status) {
        return res.status(400).json({ error: 'status is required' });
    }
    try {
        const order = await prisma.$transaction(async (tx) => {
            const existingOrder = await tx.order.findUnique({
                where: { id: orderId },
                include: { items: true },
            });
            if (!existingOrder) {
                const err = new Error('Order not found');
                err.code = 'ORDER_NOT_FOUND';
                throw err;
            }

            const previousStatus = (existingOrder.status || '').toUpperCase();
            const shouldRestock = !RESTOCK_STATUSES.has(previousStatus) && RESTOCK_STATUSES.has(status);

            if (shouldRestock) {
                const productQuantityMap = existingOrder.items.reduce((productQuantities, item) => {
                    productQuantities.set(item.productId, (productQuantities.get(item.productId) || 0) + item.quantity);
                    return productQuantities;
                }, new Map());

                for (const [productId, quantity] of productQuantityMap.entries()) {
                    await adjustStock(tx, {
                        productId,
                        delta: quantity,
                        reason: 'ORDER_RESTOCKED',
                        orderId: existingOrder.id,
                    });
                }
            }

            return tx.order.update({
                where: { id: orderId },
                data: { status },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    items: { include: { product: true } },
                },
            });
        });
        return res.json(order);
    } catch (err) {
        if (err.code === 'ORDER_NOT_FOUND' || err.code === 'P2025') {
            return res.status(404).json({ error: 'Order not found' });
        }
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
        await prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id: orderId },
                include: { items: true },
            });
            if (!order) {
                const err = new Error('Order not found');
                err.code = 'ORDER_NOT_FOUND';
                throw err;
            }

            if (!RESTOCK_STATUSES.has((order.status || '').toUpperCase())) {
                const productQuantityMap = order.items.reduce((productQuantities, item) => {
                    productQuantities.set(item.productId, (productQuantities.get(item.productId) || 0) + item.quantity);
                    return productQuantities;
                }, new Map());
                for (const [productId, quantity] of productQuantityMap.entries()) {
                    await adjustStock(tx, {
                        productId,
                        delta: quantity,
                        reason: 'ORDER_DELETED',
                        orderId: order.id,
                    });
                }
            }

            await tx.orderItem.deleteMany({ where: { orderId } });
            await tx.order.delete({ where: { id: orderId } });
        });
        return res.json({ message: 'Order deleted successfully' });
    } catch (err) {
        if (err.code === 'ORDER_NOT_FOUND' || err.code === 'P2025') {
            return res.status(404).json({ error: 'Order not found' });
        }
        return serverError(res, err);
    }
});

module.exports = router;
