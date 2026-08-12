import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hashPassword(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

async function main() {
  const login = process.env.ADMIN_LOGIN;
  const password = process.env.ADMIN_PASSWORD;

  if (!login || !password) {
    throw new Error('ADMIN_LOGIN and ADMIN_PASSWORD are required for prisma:seed');
  }

  await prisma.admin.upsert({
    where: { login },
    update: {
      passwordHash: hashPassword(password),
      role: 'admin',
    },
    create: {
      login,
      passwordHash: hashPassword(password),
      role: 'admin',
      permissions: ['orders:read', 'orders:write'],
    },
  });
}

main().finally(async () => {
  await prisma.$disconnect();
});
