const express = require('express');
const router = express.Router();
const { authenticateJwt, requireRole } = require('../middleware/auth');
const {
    PROMOTION_TYPES,
    validateAndNormalizePromotionInput,
    validatePromotionOverlap,
    getActiveNativePromotionMap,
    resolveEventPromotionByCode,
} = require('../services/promotionService');

function serverError(res, err) {
    if (err?.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
    }
    if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'Promo code must be unique.' });
    }
    console.error('[promotions] Route error:', err);
    return res.status(500).json({ error: 'Internal server error' });
}

function parseCheckoutItems(items) {
    if (!Array.isArray(items)) return [];
    return items
        .map((item) => ({
            productId: Number.parseInt(item.productId, 10),
            quantity: Number.parseInt(item.quantity, 10),
            price: Number.parseFloat(item.price),
        }))
        .filter((item) => (
            Number.isInteger(item.productId)
            && item.productId > 0
            && Number.isInteger(item.quantity)
            && item.quantity > 0
            && Number.isFinite(item.price)
            && item.price >= 0
        ));
}

async function serializePromotion(promo, prisma) {
    if (!promo) return promo;
    if (promo.categoryRef || promo.productRef) return promo;
    return prisma.promotion.findUnique({
        where: { id: promo.id },
        include: {
            categoryRef: { select: { id: true, name: true } },
            productRef: { select: { id: true, name: true, sku: true } },
        },
    });
}

function buildPromotionPayload(input) {
    const type = String(input?.type || '').trim().toUpperCase();
    return {
        campaignName: input?.campaignName,
        type,
        promoCode: type === PROMOTION_TYPES.EVENT ? input?.promoCode : null,
        discountPercentage: input?.discountPercentage,
        startDate: input?.startDate,
        endDate: input?.endDate,
        isActive: input?.isActive,
        categoryId: type === PROMOTION_TYPES.CATEGORY ? input?.categoryId : null,
        categoryName: type === PROMOTION_TYPES.CATEGORY ? input?.categoryName : null,
        productId: type === PROMOTION_TYPES.PRODUCT ? input?.productId : null,
    };
}

// POST /apply - apply promo code (must be before /:id routes)
router.post('/apply', async (req, res) => {
    const prisma = req.app.locals.prisma;
    const { promoCode, originalPrice } = req.body;
    if (!promoCode) {
        return res.status(400).json({ error: 'promoCode is required' });
    }

    try {
        const now = new Date();
        const promo = await resolveEventPromotionByCode(prisma, promoCode, now);
        const checkoutItems = parseCheckoutItems(req.body.items);

        let parsedOriginalPrice = Number.parseFloat(originalPrice);
        if (!Number.isFinite(parsedOriginalPrice) || parsedOriginalPrice < 0) {
            if (checkoutItems.length === 0) {
                return res.status(400).json({ error: 'originalPrice must be a non-negative number.' });
            }
            parsedOriginalPrice = checkoutItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        }

        let eligibleSubtotal = parsedOriginalPrice;
        if (checkoutItems.length > 0) {
            const productIds = [...new Set(checkoutItems.map((item) => item.productId))];
            const products = await prisma.product.findMany({
                where: { id: { in: productIds }, isActive: true },
                select: { id: true, categoryId: true },
            });
            const nativePromotionMap = await getActiveNativePromotionMap(prisma, products, now);
            eligibleSubtotal = checkoutItems.reduce((sum, item) => (
                nativePromotionMap.has(item.productId) ? sum : sum + (item.price * item.quantity)
            ), 0);
        }

        if (eligibleSubtotal <= 0) {
            return res.status(400).json({ error: 'Promo code cannot be applied to already discounted items.' });
        }

        const discount = (eligibleSubtotal * promo.discountPercentage) / 100;
        const discountedPrice = Math.max(0, parsedOriginalPrice - discount);
        res.json({
            originalPrice: parsedOriginalPrice,
            eligibleSubtotal,
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
        const promotions = await prisma.promotion.findMany({
            include: {
                categoryRef: { select: { id: true, name: true } },
                productRef: { select: { id: true, name: true, sku: true } },
            },
            orderBy: { id: 'desc' },
        });
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
                type: PROMOTION_TYPES.EVENT,
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

// POST /preview - validate promotion payload and return overlap details before save
router.post('/preview', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    const promotionId = Number.parseInt(req.body?.promotionId, 10);
    try {
        let existingPromotion = null;
        if (Number.isInteger(promotionId) && promotionId > 0) {
            existingPromotion = await prisma.promotion.findUnique({ where: { id: promotionId } });
            if (!existingPromotion) {
                return res.status(404).json({ error: 'Promotion not found.' });
            }
        }

        const payload = buildPromotionPayload(req.body);
        const promotionData = await validateAndNormalizePromotionInput(prisma, payload, { existingPromotion });
        await validatePromotionOverlap(prisma, promotionData, {
            excludeId: existingPromotion?.id || null,
        });

        return res.json({ ok: true, message: 'No overlap detected.' });
    } catch (err) {
        if (err?.statusCode === 409) {
            return res.status(200).json({
                ok: false,
                message: err.message,
                conflict: err.details?.blockingPromotion || null,
                reason: err.details?.reason || 'OVERLAP',
            });
        }
        return serverError(res, err);
    }
});

// GET /:id - get single promotion
router.get('/:id', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    try {
        const promo = await prisma.promotion.findUnique({
            where: { id: parseInt(req.params.id, 10) },
            include: {
                categoryRef: { select: { id: true, name: true } },
                productRef: { select: { id: true, name: true, sku: true } },
            },
        });
        if (!promo) return res.status(404).json({ error: 'Promotion not found' });
        res.json(promo);
    } catch (err) {
        return serverError(res, err);
    }
});

// POST / - create promotion
router.post('/', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    try {
        const promotionData = await validateAndNormalizePromotionInput(prisma, buildPromotionPayload(req.body));
        await validatePromotionOverlap(prisma, promotionData);
        const promo = await prisma.promotion.create({
            data: promotionData,
        });
        const serialized = await serializePromotion(promo, prisma);
        res.status(201).json(serialized);
    } catch (err) {
        return serverError(res, err);
    }
});

// PUT /:id - update promotion
router.put('/:id', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid promotion id' });
    }
    try {
        const existing = await prisma.promotion.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Promotion not found' });
        }
        const data = await validateAndNormalizePromotionInput(prisma, buildPromotionPayload(req.body), { existingPromotion: existing });
        await validatePromotionOverlap(prisma, data, { excludeId: id });
        const promo = await prisma.promotion.update({ where: { id }, data });
        const serialized = await serializePromotion(promo, prisma);
        res.json(serialized);
    } catch (err) {
        return serverError(res, err);
    }
});

// DELETE /:id - delete promotion
router.delete('/:id', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    try {
        await prisma.promotion.delete({ where: { id: parseInt(req.params.id, 10) } });
        res.json({ message: 'Promotion deleted successfully' });
    } catch (err) {
        return serverError(res, err);
    }
});

module.exports = router;
