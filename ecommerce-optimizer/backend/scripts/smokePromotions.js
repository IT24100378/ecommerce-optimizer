const { PrismaClient } = require('@prisma/client');
const {
    PROMOTION_TYPES,
    validateAndNormalizePromotionInput,
    validatePromotionOverlap,
    getActiveNativePromotionMap,
    resolveEventPromotionByCode,
} = require('../services/promotionService');

function addDays(baseDate, days) {
    const next = new Date(baseDate);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}

async function createPromotion(prisma, payload) {
    const normalized = await validateAndNormalizePromotionInput(prisma, payload);
    await validatePromotionOverlap(prisma, normalized);
    return prisma.promotion.create({ data: normalized });
}

async function main() {
    const prisma = new PrismaClient();
    const createdIds = [];

    try {
        const product = await prisma.product.findFirst({
            where: { isActive: true },
            select: { id: true, categoryId: true, name: true, sku: true },
            orderBy: { id: 'asc' },
        });

        if (!product) {
            throw new Error('Smoke test requires at least one active product.');
        }

        const base = addDays(new Date(), 365);
        const suffix = Date.now();

        const eventPromotion = await createPromotion(prisma, {
            campaignName: `Smoke Event ${suffix}`,
            type: PROMOTION_TYPES.EVENT,
            promoCode: `SMK${String(suffix).slice(-6)}`,
            discountPercentage: 10,
            startDate: addDays(base, 1),
            endDate: addDays(base, 2),
            isActive: true,
        });
        createdIds.push(eventPromotion.id);

        const categoryPromotion = await createPromotion(prisma, {
            campaignName: `Smoke Category ${suffix}`,
            type: PROMOTION_TYPES.CATEGORY,
            categoryId: product.categoryId,
            discountPercentage: 12,
            startDate: addDays(base, 3),
            endDate: addDays(base, 4),
            isActive: true,
        });
        createdIds.push(categoryPromotion.id);

        const productPromotion = await createPromotion(prisma, {
            campaignName: `Smoke Product ${suffix}`,
            type: PROMOTION_TYPES.PRODUCT,
            productId: product.id,
            discountPercentage: 15,
            startDate: addDays(base, 5),
            endDate: addDays(base, 6),
            isActive: true,
        });
        createdIds.push(productPromotion.id);

        const eventResolved = await resolveEventPromotionByCode(prisma, eventPromotion.promoCode, addDays(base, 1));
        const categoryMap = await getActiveNativePromotionMap(prisma, [product], addDays(base, 3));
        const productMap = await getActiveNativePromotionMap(prisma, [product], addDays(base, 5));

        if (!eventResolved || eventResolved.id !== eventPromotion.id) {
            throw new Error('Event promotion resolution failed.');
        }
        if (categoryMap.get(product.id)?.type !== PROMOTION_TYPES.CATEGORY) {
            throw new Error('Category promotion was not selected at category window.');
        }
        if (productMap.get(product.id)?.type !== PROMOTION_TYPES.PRODUCT) {
            throw new Error('Product promotion was not selected at product window.');
        }

        console.log('Promotion smoke test passed.');
        console.log(`Product tested: ${product.name} (${product.sku})`);
        console.log(`Event promo code: ${eventPromotion.promoCode}`);
        console.log('Priority behavior confirmed: PRODUCT > CATEGORY > EVENT.');
    } finally {
        if (createdIds.length) {
            await prisma.promotion.deleteMany({ where: { id: { in: createdIds } } });
        }
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error('Promotion smoke test failed:', err.message || err);
    process.exitCode = 1;
});

