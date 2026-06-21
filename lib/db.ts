import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * A single Prisma client across hot reloads. Next's dev server re-evaluates
 * modules on change; without the global cache each reload would spawn a new
 * connection pool, eventually exhausting Postgres' `max_connections`.
 *
 * Prisma 7 uses an explicit driver adapter — we wrap `pg` here with
 * `PrismaPg` and hand it to the client. The connection string comes from
 * the same DATABASE_URL the migrate workflow uses (configured in
 * `prisma.config.ts`).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function makeClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
