const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();
    try {
        const categoryCount = await prisma.category.count();
        const productWithCategory = await prisma.product.findFirst({
            include: { categoryRef: true },
            orderBy: { id: 'asc' },
        });

        console.log('categoryCount:', categoryCount);
        if (productWithCategory) {
            console.log('sampleProductCategory:', productWithCategory.categoryRef?.name || '(none)');
        } else {
            console.log('sampleProductCategory: no products found');
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});

