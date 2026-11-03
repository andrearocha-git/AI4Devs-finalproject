import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Umbral de la Service Layer decidido el 2026-11-02 (TK-02a): 80 %. Solo se aplica con `npm run test:coverage`.
      include: ["src/services/**/*.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
