import { PrismaClient } from "@prisma/client";
import { permissions } from "@billtrack/shared";

const prisma = new PrismaClient();

for (const key of permissions) {
  await prisma.permission.upsert({
    where: { key },
    update: {},
    create: {
      key,
      description: key
        .toLowerCase()
        .split("_")
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" "),
    },
  });
}

await prisma.$disconnect();
