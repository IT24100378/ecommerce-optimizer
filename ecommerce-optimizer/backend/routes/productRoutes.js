const express = require('express');
const router = express.Router();
const { authenticateJwt, requireRole } = require('../middleware/auth');
const { ensureInventoryRecord, mapProductWithInventory } = require('../services/inventoryService');
const { getAllCategories, normalizeCategoryName } = require('../services/categoryService');

function serverError(res, err, fallbackMessage) {
    console.error('[products] Route error:', err);
    return res.status(500).json({ error: fallbackMessage || 'Internal server error' });
}

async function validateCategorySelection(prisma, category) {
    const normalizedCategory = normalizeCategoryName(category);
    if (!normalizedCategory) {
        return { ok: false, error: 'Category is required.' };
    }

    const categories = await getAllCategories(prisma);
    const isKnownCategory = categories.some((item) => item.toLowerCase() === normalizedCategory.toLowerCase());
    if (!isKnownCategory) {
        return { ok: false, error: 'Please select a valid existing category.' };
    }

    return { ok: true, category: normalizedCategory };
}

// productRoutes.js receives prisma via the app's locals
// so it can be reused and tested in isolation

// POST /api/products – Create a new product
router.post('/', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    try {
        const { name, description, sku, category, basePrice, imageUrl } = req.body;
        const prisma = req.app.locals.prisma;
        const categoryCheck = await validateCategorySelection(prisma, category);
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
                    category: categoryCheck.category,
                    basePrice: parsedBasePrice,
                    imageUrl,
                    // Stock is controlled by Inventory; default product stock to 0 for compatibility.
                    stockQuantity: 0,
                },
            });
            await ensureInventoryRecord(tx, createdProduct.id);
            return tx.product.findUnique({
                where: { id: createdProduct.id },
                include: { inventory: true },
            });
        });

        res.status(201).json({ message: 'Product created successfully!', product: mapProductWithInventory(newProduct) });
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
            include: { inventory: true },
        });

        if (!product) return res.status(404).json({ error: 'Product not found.' });
        res.status(200).json(mapProductWithInventory(product));
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
            include: { inventory: true },
            orderBy: { createdAt: 'desc' },
        });

        res.status(200).json(products.map(mapProductWithInventory));
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
            const categoryCheck = await validateCategorySelection(prisma, category);
            if (!categoryCheck.ok) {
                return res.status(400).json({ error: categoryCheck.error });
            }
            data.category = categoryCheck.category;
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
                include: { inventory: true },
            });
            if (!updated.inventory) {
                await ensureInventoryRecord(tx, updated.id);
            }
            return tx.product.findUnique({ where: { id: updated.id }, include: { inventory: true } });
        });

        res.status(200).json({ message: 'Product updated successfully!', product: mapProductWithInventory(updatedProduct) });
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
