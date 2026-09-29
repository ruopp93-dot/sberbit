import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function main() {
  const login = process.env.ADMIN_LOGIN || "admin";
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.length < 12 || password === "change-me") {
    throw new Error("Set ADMIN_PASSWORD (at least 12 characters) before seeding the admin account.");
  }

  const passwordHash = hashPassword(password);

  await prisma.admin.upsert({
    where: { login },
    update: { passwordHash },
    create: {
      login,
      passwordHash,
      role: "admin",
      permissions: "all",
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
