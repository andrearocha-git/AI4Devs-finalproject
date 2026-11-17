import { cpSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// `tsc` solo emite JavaScript: las migraciones SQL se leen en ejecución desde `./migrations/` junto al módulo compilado
// (src/database/sqlite-storage-manager.ts), así que hay que copiarlas al directorio de salida del build.
// Uso: node scripts/copy-assets.mjs [directorio-de-salida]   (por defecto `dist`, relativo al directorio actual)
const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = resolve(process.argv[2] ?? "dist");

cpSync(join(root, "src", "database", "migrations"), join(outDir, "database", "migrations"), { recursive: true });
