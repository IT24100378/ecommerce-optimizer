const express = require('express');
const router = express.Router();
const { authenticateJwt, requireRole } = require('../middleware/auth');
const { getAllCategories, createCategory } = require('../services/categoryService');

function handleRouteError(res, err, fallbackMessage) {
    if (err?.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
    }
    console.error('[categories] Route error:', err);
    return res.status(500).json({ error: fallbackMessage || 'Internal server error' });
}

router.get('/', async (req, res) => {
    try {
        const prisma = req.app.locals.prisma;
        const categories = await getAllCategories(prisma);
        return res.status(200).json(categories);
    } catch (err) {
        return handleRouteError(res, err, 'Failed to fetch categories.');
    }
});

router.post('/', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    try {
        const prisma = req.app.locals.prisma;
        const category = await createCategory(prisma, req.body?.name);
        return res.status(201).json({ message: 'Category created successfully.', category });
    } catch (err) {
        return handleRouteError(res, err, 'Failed to create category.');
    }
});

module.exports = router;

