import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const login = process.env.ADMIN_LOGIN || "admin";
  const password = process.env.ADMIN_PASSWORD || "change-me";

  const passwordHash = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

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
  .catch(console.error)
  .finally(() => prisma.$disconnect());
