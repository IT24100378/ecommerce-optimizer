const fs = require('fs');
const path = require('path');

const CATEGORY_FILE_PATH = path.resolve(__dirname, '..', 'data', 'categories.json');

function normalizeCategoryName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function readPersistedCategories() {
    try {
        if (!fs.existsSync(CATEGORY_FILE_PATH)) {
            return [];
        }
        const raw = fs.readFileSync(CATEGORY_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .map(normalizeCategoryName)
            .filter(Boolean);
    } catch (err) {
        console.warn('[categories] Failed to read category file:', err.message);
        return [];
    }
}

function writePersistedCategories(categories) {
    const dir = path.dirname(CATEGORY_FILE_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CATEGORY_FILE_PATH, JSON.stringify(categories, null, 2));
}

function mergeUniqueCategories(values) {
    const seen = new Set();
    const merged = [];

    values
        .map(normalizeCategoryName)
        .filter(Boolean)
        .forEach((name) => {
            const key = name.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(name);
            }
        });

    return merged.sort((a, b) => a.localeCompare(b));
}

async function getAllCategories(prisma) {
    const persisted = readPersistedCategories();
    const productRows = await prisma.product.findMany({
        where: { isActive: true },
        select: { category: true },
        distinct: ['category'],
    });
    const fromProducts = productRows.map((row) => row.category);
    return mergeUniqueCategories([...persisted, ...fromProducts]);
}

async function createCategory(prisma, rawName) {
    const name = normalizeCategoryName(rawName);
    if (!name) {
        const err = new Error('Category name is required.');
        err.statusCode = 400;
        throw err;
    }

    const categories = await getAllCategories(prisma);
    const alreadyExists = categories.some((item) => item.toLowerCase() === name.toLowerCase());
    if (alreadyExists) {
        const err = new Error('Category already exists.');
        err.statusCode = 409;
        throw err;
    }

    const persisted = readPersistedCategories();
    const next = mergeUniqueCategories([...persisted, name]);
    writePersistedCategories(next);

    return name;
}

module.exports = {
    getAllCategories,
    createCategory,
    normalizeCategoryName,
};

