const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { authenticateJwt, requireRole } = require('../middleware/auth');

function serverError(res, err) {
    console.error('[reviews] Route error:', err);
    return res.status(500).json({ error: 'Internal server error' });
}

// GET /can-review?productId=Y
// Returns { canReview, reason, existingReview }
// Must be defined before /:id route to avoid conflict
router.get('/can-review', authenticateJwt, requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    const { productId } = req.query;
    if (!productId) {
        return res.status(400).json({ error: 'productId is required' });
    }
    try {
        const uid = req.user.id;
        const pid = parseInt(productId);

        // Check user exists
        const user = await prisma.user.findUnique({ where: { id: uid } });
        if (!user) return res.json({ canReview: false, reason: 'User not found' });

        // Check user has purchased this product
        const purchase = await prisma.orderItem.findFirst({
            where: {
                productId: pid,
                order: { userId: uid },
            },
        });
        if (!purchase) {
            return res.json({ canReview: false, reason: 'You must purchase this product before writing a review' });
        }

        // Check for existing review
        const existingReview = await prisma.review.findFirst({
            where: { userId: uid, productId: pid },
        });

        return res.json({ canReview: true, existingReview: existingReview || null });
    } catch (err) {
        return serverError(res, err);
    }
});

// GET / - list all reviews, ?productId=X for filtering, ?adminView=true to show hidden
router.get('/', async (req, res) => {
    const prisma = req.app.locals.prisma;
    const { productId, adminView } = req.query;
    const where = {};
    if (productId) where.productId = parseInt(productId);
    if (adminView !== 'true') {
        where.isHidded = { not: true };
    }
    try {
        if (adminView === 'true') {
            const authHeader = req.headers.authorization || '';
            const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
            if (!token || !process.env.JWT_SECRET) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
            } catch (verifyErr) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
            if (decoded.role !== 'ADMIN') {
                return res.status(403).json({ error: 'Forbidden' });
            }
        }
        const reviews = await prisma.review.findMany({
            where,
            include: {
                user: { select: { id: true, name: true } },
                product: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.json(reviews);
    } catch (err) {
        return serverError(res, err);
    }
});

// GET /:id - get single review
router.get('/:id', async (req, res) => {
    const prisma = req.app.locals.prisma;
    try {
        const review = await prisma.review.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                user: { select: { id: true, name: true } },
                product: { select: { id: true, name: true } },
            },
        });
        if (!review) return res.status(404).json({ error: 'Review not found' });
        return res.json(review);
    } catch (err) {
        return serverError(res, err);
    }
});

// POST / - create review (customer only, must have purchased the product)
router.post('/', authenticateJwt, requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    const { productId, rating, comment } = req.body;
    const parsedRating = parseInt(rating, 10);
    if (!productId || Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({ error: 'productId and rating are required' });
    }
    try {
        const uid = req.user.id;
        const pid = parseInt(productId);

        // Check user exists
        const user = await prisma.user.findUnique({ where: { id: uid } });
        if (!user) return res.status(403).json({ error: 'User not found' });

        // Check user has purchased this product
        const purchase = await prisma.orderItem.findFirst({
            where: {
                productId: pid,
                order: { userId: uid },
            },
        });
        if (!purchase) {
            return res.status(403).json({ error: 'You must purchase this product before writing a review' });
        }

        // Prevent duplicate reviews
        const existing = await prisma.review.findFirst({
            where: { userId: uid, productId: pid },
        });
        if (existing) {
            return res.status(409).json({ error: 'You have already reviewed this product' });
        }

        const review = await prisma.review.create({
            data: {
                userId: uid,
                productId: pid,
                rating: parsedRating,
                comment,
            },
            include: {
                user: { select: { id: true, name: true } },
                product: { select: { id: true, name: true } },
            },
        });
        return res.status(201).json(review);
    } catch (err) {
        return serverError(res, err);
    }
});

// PUT /:id - update review
// Admin: can only update isHidded (when only isHidded is sent)
// Customer: can update rating/comment for their own review (sets isEdited=true)
router.put('/:id', authenticateJwt, async (req, res) => {
    const prisma = req.app.locals.prisma;
    const { rating, comment, isHidded } = req.body;
    try {
        const review = await prisma.review.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!review) return res.status(404).json({ error: 'Review not found' });

        const data = {};

        // Admin moderation: only isHidded is being updated
        if (isHidded !== undefined && rating === undefined && comment === undefined) {
            if (req.user.role !== 'ADMIN') {
                return res.status(403).json({ error: 'Only admins can moderate visibility' });
            }
            data.isHidded = isHidded;
        } else {
            // Customer edit: verify ownership and mark as edited
            if (req.user.id !== review.userId) {
                return res.status(403).json({ error: 'You can only edit your own reviews' });
            }
            if (rating !== undefined) data.rating = parseInt(rating);
            if (comment !== undefined) data.comment = comment;
            data.isEdited = true;
        }

        const updated = await prisma.review.update({
            where: { id: parseInt(req.params.id) },
            data,
            include: {
                user: { select: { id: true, name: true } },
                product: { select: { id: true, name: true } },
            },
        });
        return res.json(updated);
    } catch (err) {
        return serverError(res, err);
    }
});

// DELETE /:id - delete review
// Customers can delete only their own review (pass userId in request body)
router.delete('/:id', authenticateJwt, async (req, res) => {
    const prisma = req.app.locals.prisma;
    try {
        const review = await prisma.review.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!review) return res.status(404).json({ error: 'Review not found' });

        if (req.user.role !== 'ADMIN' && req.user.id !== review.userId) {
            return res.status(403).json({ error: 'You can only delete your own reviews' });
        }

        await prisma.review.delete({ where: { id: parseInt(req.params.id) } });
        return res.json({ message: 'Review deleted successfully' });
    } catch (err) {
        return serverError(res, err);
    }
});

module.exports = router;
