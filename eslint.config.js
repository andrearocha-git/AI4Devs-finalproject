import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

// Rutas fuera del alcance del lint (CLAUDE.md: docs/ y .claude/ se excluyen).
const ignored = ["docs/**", ".claude/**", "node_modules/**", "dist/**", "coverage/**"];

// Reglas de acoplamiento de capas (docs/002-arquitectura-del-sistema.md §2.3).
const sqliteOnlyInStorageManager = {
  paths: [
    {
      name: "node:sqlite",
      message: "Solo src/database/sqlite-storage-manager.ts puede importar node:sqlite.",
    },
  ],
};

// Solo el Orquestador (y los tests, que viven fuera de src/) importa el storage manager.
const storageManagerOnlyInOrchestrator = {
  group: ["**/sqlite-storage-manager", "**/sqlite-storage-manager.js"],
  message: "Solo el Orquestador (src/services/orchestrator/) puede importar sqlite-storage-manager.",
};

const tuiOnlyTalksToOrchestrator = {
  patterns: [
    {
      group: [
        "**/database/**",
        "**/services/jira/**",
        "**/services/ollama/**",
        "**/services/git/**",
        "**/services/filesystem/**",
      ],
      message: "La TUI solo puede hablar con el Orquestador (src/services/orchestrator/).",
    },
  ],
};

export default defineConfig([
  { ignores: ignored },
  {
    files: ["**/*.ts"],
    extends: [tseslint.configs.recommended],
  },
  {
    files: ["**/*.ts"],
    ignores: ["src/database/sqlite-storage-manager.ts"],
    rules: { "no-restricted-imports": ["error", sqliteOnlyInStorageManager] },
  },
  {
    files: ["src/**/*.ts"],
    ignores: ["src/database/sqlite-storage-manager.ts", "src/services/orchestrator/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { ...sqliteOnlyInStorageManager, patterns: [storageManagerOnlyInOrchestrator] },
      ],
    },
  },
  {
    files: ["src/tui/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { ...sqliteOnlyInStorageManager, ...tuiOnlyTalksToOrchestrator }],
    },
  },
]);
