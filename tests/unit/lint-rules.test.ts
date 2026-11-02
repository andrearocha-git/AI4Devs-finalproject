import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const eslint = new ESLint({ cwd: root });

async function restrictedImportErrors(code: string, relativePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(root, relativePath) });
  return (result?.messages ?? [])
    .filter((m) => m.severity === 2 && m.ruleId === "no-restricted-imports")
    .map((m) => m.message);
}

describe("reglas de lint: acoplamiento de capas", () => {
  const sqliteImport = 'import { DatabaseSync } from "node:sqlite";\nexport const db = DatabaseSync;\n';

  it("rechaza importar node:sqlite fuera de sqlite-storage-manager.ts", async () => {
    const errors = await restrictedImportErrors(sqliteImport, "src/services/orchestrator/ticket-orchestrator.ts");
    expect(errors).not.toHaveLength(0);
  });

  it("permite importar node:sqlite en sqlite-storage-manager.ts", async () => {
    const errors = await restrictedImportErrors(sqliteImport, "src/database/sqlite-storage-manager.ts");
    expect(errors).toHaveLength(0);
  });

  it.each([
    "../database/sqlite-storage-manager.js",
    "../services/jira/jira-rest-client.js",
    "../services/ollama/ollama-ai-transformer.js",
    "../services/git/git-manager.js",
    "../services/filesystem/filesystem-manager.js",
  ])("rechaza que src/tui/ importe %s", async (specifier) => {
    const code = `import { dep } from "${specifier}";\nexport const x = dep;\n`;
    const errors = await restrictedImportErrors(code, "src/tui/commands/start.command.ts");
    expect(errors).not.toHaveLength(0);
  });

  it("permite que src/tui/ importe del orquestador", async () => {
    const code = 'import { dep } from "../../services/orchestrator/ticket-orchestrator.js";\nexport const x = dep;\n';
    const errors = await restrictedImportErrors(code, "src/tui/commands/start.command.ts");
    expect(errors).toHaveLength(0);
  });
});

describe("reglas de lint: exclusiones", () => {
  it.each(["docs/ejemplo.ts", ".claude/ejemplo.ts", "node_modules/pkg/index.ts"])(
    "ignora %s",
    async (relativePath) => {
      expect(await eslint.isPathIgnored(join(root, relativePath))).toBe(true);
    },
  );
});
