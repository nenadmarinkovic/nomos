import { PrismaClient } from "@prisma/client";

/**
 * A single Prisma client across hot reloads. Next's dev server re-evaluates
 * modules on change; without the global cache each reload would open a new pool
 * of connections until SQLite refused them.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
