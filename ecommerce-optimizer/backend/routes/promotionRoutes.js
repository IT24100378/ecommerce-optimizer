const express = require('express');
const router = express.Router();
const { authenticateJwt, requireRole } = require('../middleware/auth');

function serverError(res, err) {
    console.error('[promotions] Route error:', err);
    return res.status(500).json({ error: 'Internal server error' });
}

// POST /apply - apply promo code (must be before /:id routes)
router.post('/apply', async (req, res) => {
    const prisma = req.app.locals.prisma;
    const { promoCode, originalPrice } = req.body;
    if (!promoCode || originalPrice === undefined) {
        return res.status(400).json({ error: 'promoCode and originalPrice are required' });
    }
    try {
        const promo = await prisma.promotion.findUnique({ where: { promoCode } });
        if (!promo) return res.status(404).json({ error: 'Promo code not found' });
        const now = new Date();
        if (!promo.isActive || promo.startDate > now || promo.endDate < now) {
            return res.status(400).json({ error: 'Promo code is not active or has expired' });
        }
        const discount = (parseFloat(originalPrice) * promo.discountPercentage) / 100;
        const discountedPrice = parseFloat(originalPrice) - discount;
        res.json({
            originalPrice: parseFloat(originalPrice),
            discountPercentage: promo.discountPercentage,
            discount,
            discountedPrice,
            promotion: promo,
        });
    } catch (err) {
        return serverError(res, err);
    }
});

// GET / - list all promotions
router.get('/', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    try {
        const promotions = await prisma.promotion.findMany({ orderBy: { id: 'desc' } });
        res.json(promotions);
    } catch (err) {
        return serverError(res, err);
    }
});

// GET /active - list only currently active promotions (public for storefront banners)
router.get('/active', async (req, res) => {
    const prisma = req.app.locals.prisma;
    const now = new Date();
    try {
        const promotions = await prisma.promotion.findMany({
            where: {
                isActive: true,
                startDate: { lte: now },
                endDate: { gte: now },
            },
            orderBy: { startDate: 'asc' },
        });
        res.json(promotions);
    } catch (err) {
        return serverError(res, err);
    }
});

// GET /:id - get single promotion
router.get('/:id', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    try {
        const promo = await prisma.promotion.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!promo) return res.status(404).json({ error: 'Promotion not found' });
        res.json(promo);
    } catch (err) {
        return serverError(res, err);
    }
});

// POST / - create promotion
router.post('/', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    const { campaignName, promoCode, discountPercentage, startDate, endDate, isActive } = req.body;
    if (!campaignName || !promoCode || !discountPercentage || !startDate || !endDate) {
        return res.status(400).json({ error: 'campaignName, promoCode, discountPercentage, startDate, endDate are required' });
    }
    try {
        const promo = await prisma.promotion.create({
            data: {
                campaignName,
                promoCode,
                discountPercentage: parseFloat(discountPercentage),
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                isActive: isActive !== undefined ? isActive : true,
            },
        });
        res.status(201).json(promo);
    } catch (err) {
        return serverError(res, err);
    }
});

// PUT /:id - update promotion
router.put('/:id', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    const { campaignName, promoCode, discountPercentage, startDate, endDate, isActive } = req.body;
    const data = {};
    if (campaignName !== undefined) data.campaignName = campaignName;
    if (promoCode !== undefined) data.promoCode = promoCode;
    if (discountPercentage !== undefined) data.discountPercentage = parseFloat(discountPercentage);
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = new Date(endDate);
    if (isActive !== undefined) data.isActive = isActive;
    try {
        const promo = await prisma.promotion.update({ where: { id: parseInt(req.params.id) }, data });
        res.json(promo);
    } catch (err) {
        return serverError(res, err);
    }
});

// DELETE /:id - delete promotion
router.delete('/:id', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    try {
        await prisma.promotion.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Promotion deleted successfully' });
    } catch (err) {
        return serverError(res, err);
    }
});

module.exports = router;
