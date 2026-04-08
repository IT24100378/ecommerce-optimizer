const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function bootstrapAdmin() {
  const prisma = new PrismaClient();
  try {
    const email = process.env.ADMIN_EMAIL || 'admin@ecommerce.local';
    const password = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@12345';
    const hash = await bcrypt.hash(password, 10);

    const admin = await prisma.user.upsert({
      where: { email },
      update: {
        name: 'System Admin',
        password: hash,
        role: 'ADMIN',
      },
      create: {
        name: 'System Admin',
        email,
        password: hash,
        role: 'ADMIN',
      },
    });

    console.log(`Admin account ready: ${admin.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

bootstrapAdmin().catch((err) => {
  console.error('Failed to bootstrap admin account:', err);
  process.exit(1);
});

