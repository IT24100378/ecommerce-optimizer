const express = require('express');
const router = express.Router();
const { getSalesPrediction } = require('../services/aiService');
const { authenticateJwt, requireRole } = require('../middleware/auth');

function serverError(res, err) {
    console.error('[forecasts] Route error:', err);
    return res.status(500).json({ error: 'Internal server error' });
}

function startOfUtcDay(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date, days) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return startOfUtcDay(next);
}

function dateKey(date) {
    return startOfUtcDay(date).toISOString().slice(0, 10);
}

function parseIsoDate(value) {
    if (!value || typeof value !== 'string') return null;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return startOfUtcDay(parsed);
}

// GET / - list all forecasts with product info
router.get('/', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    try {
        const forecasts = await prisma.demandForecast.findMany({
            include: { product: true },
            orderBy: { generatedAt: 'desc' },
        });
        res.json(forecasts);
    } catch (err) {
        return serverError(res, err);
    }
});

// GET /product/:productId - get forecasts for specific product
router.get('/product/:productId', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    try {
        const forecasts = await prisma.demandForecast.findMany({
            where: { productId: parseInt(req.params.productId) },
            include: { product: true },
            orderBy: { forecastForDate: 'asc' },
        });
        res.json(forecasts);
    } catch (err) {
        return serverError(res, err);
    }
});

// POST / - create/store forecast
router.post('/', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    const { productId, predictedDemand, forecastForDate } = req.body;
    if (!productId || predictedDemand === undefined || !forecastForDate) {
        return res.status(400).json({ error: 'productId, predictedDemand, and forecastForDate are required' });
    }
    try {
        const forecast = await prisma.demandForecast.create({
            data: {
                productId: parseInt(productId),
                predictedDemand: parseInt(predictedDemand),
                forecastForDate: new Date(forecastForDate),
            },
            include: { product: true },
        });
        res.status(201).json(forecast);
    } catch (err) {
        return serverError(res, err);
    }
});

// POST /predict - generate and store AI forecasts for a custom date range
router.post('/predict', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    const productId = parseInt(req.body.productId, 10);
    const startDate = parseIsoDate(req.body.startDate);
    const endDate = parseIsoDate(req.body.endDate);
    const days = parseInt(req.body.days, 10);
    const hasDays = req.body.days !== undefined && req.body.days !== null && req.body.days !== '';
    const hasEndDate = Boolean(req.body.endDate);
    const MAX_FORECAST_DAYS = 366;

    if (!productId || Number.isNaN(productId) || productId <= 0) {
        return res.status(400).json({ error: 'A valid productId is required' });
    }

    if (!startDate) {
        return res.status(400).json({ error: 'A valid startDate (YYYY-MM-DD) is required' });
    }

    if (!hasDays && !hasEndDate) {
        return res.status(400).json({ error: 'Provide either days or endDate' });
    }

    if (hasEndDate && !endDate) {
        return res.status(400).json({ error: 'A valid endDate (YYYY-MM-DD) is required' });
    }

    if (hasDays && (!days || Number.isNaN(days) || days < 1 || days > MAX_FORECAST_DAYS)) {
        return res.status(400).json({ error: `days must be between 1 and ${MAX_FORECAST_DAYS}` });
    }

    let totalDays = hasDays ? days : 0;
    let resolvedEndDate = endDate;

    if (endDate && endDate < startDate) {
        return res.status(400).json({ error: 'endDate must be the same as or after startDate' });
    }

    if (!hasDays && endDate) {
        totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    } else if (hasDays && !endDate) {
        resolvedEndDate = addUtcDays(startDate, totalDays - 1);
    } else if (hasDays && endDate) {
        const rangeDays = Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        if (rangeDays !== totalDays) {
            return res.status(400).json({ error: 'days must match the number of days in the selected date range' });
        }
    }

    if (totalDays > MAX_FORECAST_DAYS) {
        return res.status(400).json({ error: `Selected range is too large. Maximum ${MAX_FORECAST_DAYS} days` });
    }

    try {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { inventory: true },
        });
        if (!product || !product.isActive) {
            return res.status(404).json({ error: 'Product not found or inactive' });
        }

        const orderItems = await prisma.orderItem.findMany({
            where: { productId },
            include: { order: { select: { orderDate: true } } },
        });

        const dailySales = {};
        orderItems.forEach((item) => {
            const key = dateKey(item.order.orderDate);
            dailySales[key] = (dailySales[key] || 0) + (item.quantity || 0);
        });

        const forecastsToCreate = [];

        for (let i = 0; i < totalDays; i += 1) {
            const targetDate = addUtcDays(startDate, i);
            const lag1Date = addUtcDays(targetDate, -1);
            const lag7Date = addUtcDays(targetDate, -7);
            const lag1 = dailySales[dateKey(lag1Date)] || 0;
            const lag7 = dailySales[dateKey(lag7Date)] || 0;

            let rollingSum = 0;
            for (let d = 1; d <= 7; d += 1) {
                rollingSum += dailySales[dateKey(addUtcDays(targetDate, -d))] || 0;
            }
            const rollingMean = rollingSum / 7;
            // Convert JS Sunday=0..Saturday=6 to model-required Monday=0..Sunday=6.
            const dayOfWeek = (targetDate.getUTCDay() + 6) % 7;

            const prediction = await getSalesPrediction({
                product_name: product.name, // required by FastAPI schema
                'Price Each': product.basePrice,
                Sales_Lag_1Day: lag1,
                Sales_Lag_7Days: lag7,
                Month: targetDate.getUTCMonth() + 1,
                DayOfWeek: dayOfWeek,
                Rolling_Mean_7D: rollingMean,
            });

            if (!prediction || prediction.predicted_quantity === undefined) {
                return res.status(503).json({ error: 'AI prediction service is unavailable' });
            }

            const predictedDemand = Math.max(0, Math.round(Number(prediction.predicted_quantity ?? 0)));
            dailySales[dateKey(targetDate)] = predictedDemand;

            forecastsToCreate.push({
                productId,
                predictedDemand,
                forecastForDate: targetDate,
            });
        }

        const firstDate = forecastsToCreate[0].forecastForDate;
        const lastDate = forecastsToCreate[forecastsToCreate.length - 1].forecastForDate;

        await prisma.$transaction([
            prisma.demandForecast.deleteMany({
                where: {
                    productId,
                    forecastForDate: {
                        gte: firstDate,
                        lte: lastDate,
                    },
                },
            }),
            prisma.demandForecast.createMany({ data: forecastsToCreate }),
        ]);

        const savedForecasts = await prisma.demandForecast.findMany({
            where: {
                productId,
                forecastForDate: {
                    gte: firstDate,
                    lte: lastDate,
                },
            },
            include: { product: true },
            orderBy: { forecastForDate: 'asc' },
        });

        const currentStock = product.inventory?.stockLevel ?? product.stockQuantity ?? 0;
        const lowStockThreshold = product.inventory?.lowStockThreshold ?? 10;
        const totalPredictedDemand = savedForecasts.reduce((sum, forecast) => sum + (forecast.predictedDemand || 0), 0);
        const recommendedRestock = Math.max(0, totalPredictedDemand - currentStock);

        return res.json({
            product: { id: product.id, name: product.name, sku: product.sku, category: product.category },
            days: totalDays,
            startDate: firstDate.toISOString().slice(0, 10),
            endDate: (resolvedEndDate || lastDate).toISOString().slice(0, 10),
            inventorySnapshot: {
                currentStock,
                lowStockThreshold,
                recommendedRestock,
            },
            predictions: savedForecasts,
        });
    } catch (err) {
        return serverError(res, err);
    }
});

// DELETE /:id - delete forecast
router.delete('/:id', authenticateJwt, requireRole('ADMIN', 'VENDOR'), async (req, res) => {
    const prisma = req.app.locals.prisma;
    try {
        await prisma.demandForecast.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Forecast deleted successfully' });
    } catch (err) {
        return serverError(res, err);
    }
});

module.exports = router;
