const PROMOTION_TYPES = {
    EVENT: 'EVENT',
    CATEGORY: 'CATEGORY',
    PRODUCT: 'PRODUCT',
};

const PROMOTION_PRIORITY = {
    [PROMOTION_TYPES.PRODUCT]: 3,
    [PROMOTION_TYPES.CATEGORY]: 2,
    [PROMOTION_TYPES.EVENT]: 1,
};

function createHttpError(statusCode, message, details = null) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (details) {
        err.details = details;
    }
    return err;
}

function toDate(value, label) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw createHttpError(400, `${label} is invalid.`);
    }
    return parsed;
}

function toPositiveNumber(value, label) {
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed) || parsed <= 0) {
        throw createHttpError(400, `${label} must be a positive number.`);
    }
    return parsed;
}

function toPositiveInt(value, label) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw createHttpError(400, `${label} must be a positive integer.`);
    }
    return parsed;
}

function normalizeCode(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return normalized || null;
}

function getBestPromotion(candidates) {
    if (!candidates.length) return null;
    return candidates.sort((a, b) => {
        const discountDiff = (b.discountPercentage || 0) - (a.discountPercentage || 0);
        if (discountDiff !== 0) return discountDiff;
        const priorityDiff = (PROMOTION_PRIORITY[b.type] || 0) - (PROMOTION_PRIORITY[a.type] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return a.id - b.id;
    })[0];
}

async function validateAndNormalizePromotionInput(prisma, payload, options = {}) {
    const { existingPromotion = null } = options;
    const type = String(payload.type || existingPromotion?.type || '').trim().toUpperCase();
    if (!Object.values(PROMOTION_TYPES).includes(type)) {
        throw createHttpError(400, 'Promotion type is required and must be EVENT, CATEGORY, or PRODUCT.');
    }

    let campaignName = String(payload.campaignName ?? existingPromotion?.campaignName ?? '').trim();
    if (!campaignName) {
        throw createHttpError(400, 'campaignName is required.');
    }

    const discountPercentage = payload.discountPercentage !== undefined
        ? toPositiveNumber(payload.discountPercentage, 'discountPercentage')
        : existingPromotion?.discountPercentage;
    if (discountPercentage === undefined) {
        throw createHttpError(400, 'discountPercentage is required.');
    }

    const startDate = payload.startDate !== undefined
        ? toDate(payload.startDate, 'startDate')
        : existingPromotion?.startDate;
    const endDate = payload.endDate !== undefined
        ? toDate(payload.endDate, 'endDate')
        : existingPromotion?.endDate;
    if (!startDate || !endDate) {
        throw createHttpError(400, 'startDate and endDate are required.');
    }
    if (endDate < startDate) {
        throw createHttpError(400, 'endDate must be after or equal to startDate.');
    }

    const isActive = payload.isActive !== undefined ? Boolean(payload.isActive) : (existingPromotion?.isActive ?? true);

    let categoryId = null;
    let productId = null;
    let promoCode = null;

    if (type === PROMOTION_TYPES.EVENT) {
        promoCode = normalizeCode(payload.promoCode ?? existingPromotion?.promoCode);
        if (!promoCode) {
            throw createHttpError(400, 'promoCode is required for EVENT promotions.');
        }
    }

    if (type === PROMOTION_TYPES.CATEGORY) {
        const hasCategoryId = payload.categoryId !== undefined && payload.categoryId !== null && String(payload.categoryId).trim() !== '';
        const hasCategoryName = payload.categoryName !== undefined && payload.categoryName !== null && String(payload.categoryName).trim() !== '';
        const rawCategoryTarget = hasCategoryId
            ? payload.categoryId
            : (hasCategoryName ? payload.categoryName : existingPromotion?.categoryId);

        if (rawCategoryTarget === undefined || rawCategoryTarget === null || String(rawCategoryTarget).trim() === '') {
            throw createHttpError(400, 'categoryId (or categoryName) is required for CATEGORY promotions.');
        }

        let categoryRecord = null;
        if (Number.isInteger(Number(rawCategoryTarget)) || /^\d+$/.test(String(rawCategoryTarget).trim())) {
            const parsedCategoryId = toPositiveInt(rawCategoryTarget, 'categoryId');
            categoryRecord = await prisma.category.findUnique({ where: { id: parsedCategoryId }, select: { id: true } });
        } else {
            categoryRecord = await prisma.category.findFirst({
                where: { name: { equals: String(rawCategoryTarget).trim(), mode: 'insensitive' } },
                select: { id: true },
            });
        }

        if (!categoryRecord) {
            throw createHttpError(400, 'Selected category does not exist.');
        }
        categoryId = categoryRecord.id;
    }

    if (type === PROMOTION_TYPES.PRODUCT) {
        productId = payload.productId !== undefined
            ? toPositiveInt(payload.productId, 'productId')
            : existingPromotion?.productId;
        if (!productId) {
            throw createHttpError(400, 'productId is required for PRODUCT promotions.');
        }
        const productExists = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, categoryId: true, isActive: true },
        });
        if (!productExists || !productExists.isActive) {
            throw createHttpError(400, 'Selected product does not exist or is inactive.');
        }
    }

    return {
        campaignName,
        type,
        promoCode,
        discountPercentage,
        startDate,
        endDate,
        isActive,
        categoryId,
        productId,
    };
}

async function validatePromotionOverlap(prisma, promotionData, options = {}) {
    void prisma;
    void promotionData;
    void options;
    // Overlaps are intentionally allowed for native promotions.
    // At runtime, the highest discount among active PRODUCT/CATEGORY promotions is applied.
}

async function getActiveNativePromotionMap(prisma, products, now = new Date()) {
    if (!products.length) return new Map();

    const productIds = products.map((item) => item.id);
    const categoryIds = [...new Set(products.map((item) => item.categoryId).filter(Boolean))];

    const promotions = await prisma.promotion.findMany({
        where: {
            isActive: true,
            startDate: { lte: now },
            endDate: { gte: now },
            OR: [
                { type: PROMOTION_TYPES.PRODUCT, productId: { in: productIds } },
                { type: PROMOTION_TYPES.CATEGORY, categoryId: { in: categoryIds } },
            ],
        },
        select: {
            id: true,
            campaignName: true,
            type: true,
            discountPercentage: true,
            categoryId: true,
            productId: true,
        },
    });

    const promotionMap = new Map();
    for (const product of products) {
        const candidates = promotions.filter((promo) => (
            (promo.type === PROMOTION_TYPES.PRODUCT && promo.productId === product.id)
            || (promo.type === PROMOTION_TYPES.CATEGORY && promo.categoryId === product.categoryId)
        ));
        const best = getBestPromotion(candidates);
        if (best) {
            promotionMap.set(product.id, best);
        }
    }

    return promotionMap;
}

async function applyNativePromotionPricing(prisma, products, now = new Date()) {
    const promotionMap = await getActiveNativePromotionMap(prisma, products, now);
    return products.map((product) => {
        const nativePromotion = promotionMap.get(product.id) || null;
        const basePrice = Number(product.basePrice || 0);
        const discountPercentage = nativePromotion?.discountPercentage || 0;
        const effectivePrice = nativePromotion
            ? Math.max(0, basePrice - ((basePrice * discountPercentage) / 100))
            : basePrice;

        return {
            ...product,
            basePrice,
            effectivePrice,
            isOnPromotion: Boolean(nativePromotion),
            nativePromotionType: nativePromotion?.type || null,
            nativePromotionDiscountPercentage: discountPercentage || null,
            nativePromotionId: nativePromotion?.id || null,
            nativePromotionName: nativePromotion?.campaignName || null,
        };
    });
}

async function resolveEventPromotionByCode(prisma, promoCode, now = new Date()) {
    const code = normalizeCode(promoCode);
    if (!code) {
        throw createHttpError(400, 'promoCode is required.');
    }

    const promo = await prisma.promotion.findFirst({
        where: {
            promoCode: code,
            type: PROMOTION_TYPES.EVENT,
            isActive: true,
            startDate: { lte: now },
            endDate: { gte: now },
        },
    });

    if (!promo) {
        throw createHttpError(404, 'Promo code not found or inactive.');
    }

    return promo;
}

module.exports = {
    PROMOTION_TYPES,
    PROMOTION_PRIORITY,
    createHttpError,
    getBestPromotion,
    validateAndNormalizePromotionInput,
    validatePromotionOverlap,
    getActiveNativePromotionMap,
    applyNativePromotionPricing,
    resolveEventPromotionByCode,
    normalizeCode,
};

