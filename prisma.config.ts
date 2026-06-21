import "dotenv/config";

import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved connection config out of schema.prisma. The migrate /
 * studio CLI reads the database URL from here; the runtime PrismaClient in
 * `lib/db.ts` constructs its own `PrismaPg` adapter from the same env var.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
