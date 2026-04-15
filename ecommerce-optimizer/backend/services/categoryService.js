function normalizeCategoryName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

async function getAllCategories(prisma) {
    const categories = await prisma.category.findMany({
        select: { name: true },
        orderBy: { name: 'asc' },
    });
    return categories.map((item) => item.name);
}

async function createCategory(prisma, rawName) {
    const name = normalizeCategoryName(rawName);
    if (!name) {
        const err = new Error('Category name is required.');
        err.statusCode = 400;
        throw err;
    }

    const existing = await prisma.category.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
    });
    if (existing) {
        const err = new Error('Category already exists.');
        err.statusCode = 409;
        throw err;
    }

    await prisma.category.create({ data: { name } });

    return name;
}

module.exports = {
    getAllCategories,
    createCategory,
    normalizeCategoryName,
};

