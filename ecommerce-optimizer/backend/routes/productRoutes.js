const express = require('express');
const router = express.Router();
const { authenticateJwt, requireRole } = require('../middleware/auth');
const { ensureInventoryRecord, mapProductWithInventory } = require('../services/inventoryService');
const { normalizeCategoryName } = require('../services/categoryService');
const { applyNativePromotionPricing } = require('../services/promotionService');

function serverError(res, err, fallbackMessage) {
    console.error('[products] Route error:', err);
    return res.status(500).json({ error: fallbackMessage || 'Internal server error' });
}

async function resolveCategorySelection(prisma, category) {
    const normalizedCategory = normalizeCategoryName(category);
    if (!normalizedCategory) {
        return { ok: false, error: 'Category is required.' };
    }

    const existingCategory = await prisma.category.findFirst({
        where: { name: { equals: normalizedCategory, mode: 'insensitive' } },
        select: { id: true, name: true },
    });
    if (!existingCategory) {
        return { ok: false, error: 'Please select a valid existing category.' };
    }

    return { ok: true, categoryId: existingCategory.id, categoryName: existingCategory.name };
}

function serializeProduct(product) {
    const mapped = mapProductWithInventory(product);
    const categoryName = product?.categoryRef?.name || '';
    const effectivePrice = Number(product?.effectivePrice ?? mapped.basePrice);
    return {
        ...mapped,
        categoryId: product?.categoryId ?? null,
        category: categoryName,
        effectivePrice,
        isOnPromotion: Boolean(product?.isOnPromotion),
        nativePromotionType: product?.nativePromotionType || null,
        nativePromotionDiscountPercentage: product?.nativePromotionDiscountPercentage ?? null,
        nativePromotionId: product?.nativePromotionId || null,
        nativePromotionName: product?.nativePromotionName || null,
        categoryRef: undefined,
    };
}

// productRoutes.js receives prisma via the app's locals
// so it can be reused and tested in isolation

// POST /api/products – Create a new product
router.post('/', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    try {
        const { name, description, sku, category, basePrice, imageUrl } = req.body;
        const prisma = req.app.locals.prisma;
        const categoryCheck = await resolveCategorySelection(prisma, category);
        if (!categoryCheck.ok) {
            return res.status(400).json({ error: categoryCheck.error });
        }
        const parsedBasePrice = Number.parseFloat(basePrice);
        if (Number.isNaN(parsedBasePrice) || parsedBasePrice < 0) {
            return res.status(400).json({ error: 'basePrice is required and must be a non-negative number.' });
        }

        const newProduct = await prisma.$transaction(async (tx) => {
            const createdProduct = await tx.product.create({
                data: {
                    name,
                    description,
                    sku,
                    categoryId: categoryCheck.categoryId,
                    basePrice: parsedBasePrice,
                    imageUrl,
                    // Stock is controlled by Inventory; default product stock to 0 for compatibility.
                    stockQuantity: 0,
                },
            });
            await ensureInventoryRecord(tx, createdProduct.id);
            return tx.product.findUnique({
                where: { id: createdProduct.id },
                include: { inventory: true, categoryRef: true },
            });
        });

        const [pricedProduct] = await applyNativePromotionPricing(prisma, [newProduct]);
        res.status(201).json({ message: 'Product created successfully!', product: serializeProduct(pricedProduct) });
    } catch (error) {
        return serverError(res, error, 'Failed to create product. SKU might already exist.');
    }
});

// GET /api/products/:id – Read a single active product
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ error: 'Invalid product ID.' });
        }
        const prisma = req.app.locals.prisma;

        const product = await prisma.product.findFirst({
            where: { id, isActive: true },
            include: { inventory: true, categoryRef: true },
        });

        if (!product) return res.status(404).json({ error: 'Product not found.' });
        const [pricedProduct] = await applyNativePromotionPricing(prisma, [product]);
        res.status(200).json(serializeProduct(pricedProduct));
    } catch (error) {
        return serverError(res, error, 'Failed to fetch product.');
    }
});

// GET /api/products – Read all active products (isActive = true)
router.get('/', async (req, res) => {
    try {
        const prisma = req.app.locals.prisma;

        const products = await prisma.product.findMany({
            where: { isActive: true },
            include: { inventory: true, categoryRef: true },
            orderBy: { createdAt: 'desc' },
        });

        const pricedProducts = await applyNativePromotionPricing(prisma, products);
        res.status(200).json(pricedProducts.map(serializeProduct));
    } catch (error) {
        return serverError(res, error, 'Failed to fetch products.');
    }
});

// PUT /api/products/:id – Update an existing product
router.put('/:id', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ error: 'Invalid product ID.' });
        }
        const { name, description, sku, category, basePrice, imageUrl } = req.body;
        const prisma = req.app.locals.prisma;
        const data = { name, description, sku, basePrice, imageUrl };
        if (category !== undefined) {
            const categoryCheck = await resolveCategorySelection(prisma, category);
            if (!categoryCheck.ok) {
                return res.status(400).json({ error: categoryCheck.error });
            }
            data.categoryId = categoryCheck.categoryId;
        }
        if (basePrice !== undefined) {
            const parsedBasePrice = Number.parseFloat(basePrice);
            if (Number.isNaN(parsedBasePrice) || parsedBasePrice < 0) {
                return res.status(400).json({ error: 'basePrice must be a non-negative number.' });
            }
            data.basePrice = parsedBasePrice;
        }

        const updatedProduct = await prisma.$transaction(async (tx) => {
            const updated = await tx.product.update({
                where: { id },
                data,
                include: { inventory: true, categoryRef: true },
            });
            if (!updated.inventory) {
                await ensureInventoryRecord(tx, updated.id);
            }
            return tx.product.findUnique({ where: { id: updated.id }, include: { inventory: true, categoryRef: true } });
        });

        const [pricedProduct] = await applyNativePromotionPricing(prisma, [updatedProduct]);
        res.status(200).json({ message: 'Product updated successfully!', product: serializeProduct(pricedProduct) });
    } catch (error) {
        return serverError(res, error, 'Failed to update product.');
    }
});

// DELETE /api/products/:id – Soft delete (set isActive = false)
router.delete('/:id', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ error: 'Invalid product ID.' });
        }
        const prisma = req.app.locals.prisma;

        await prisma.product.update({
            where: { id },
            data: { isActive: false },
        });

        res.status(200).json({ message: 'Product deleted successfully.' });
    } catch (error) {
        return serverError(res, error, 'Failed to delete product.');
    }
});

module.exports = router;
