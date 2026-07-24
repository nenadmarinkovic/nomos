import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// The engine and its config are pure TS with no DOM dependencies, so the
// suite runs in a plain Node environment. The single `@` alias mirrors the
// tsconfig path mapping so `@/lib/...` imports resolve the same way they do
// under Next.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
