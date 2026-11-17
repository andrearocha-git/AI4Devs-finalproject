import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// GH-55 · E3 — La documentación refleja el instalador (`scripts/install.ps1`) y dice la verdad sobre quién comprueba la versión
// de Node. Solo vigila que los textos existan y no contradigan el instalador; no juzga la redacción.

const ROOT = process.cwd();
const read = (file: string): string => readFileSync(join(ROOT, file), "utf8");

const README = "README.md";
const DOC_001 = "docs/001-descripcion-general-del-producto.md";
const DOC_002 = "docs/002-arquitectura-del-sistema.md";
const DOC_009 = "docs/009-flujo-funcional.md";

/** Texto de la sección que empieza en el encabezado indicado, hasta el siguiente encabezado de nivel 1 a 3 (sin contar los bloques de código). */
function readSection(file: string, heading: RegExp): string {
  const lines = read(file).split("\n");
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) return "";
  const section: string[] = [];
  let inCode = false;
  for (const line of lines.slice(start + 1)) {
    if (line.trimStart().startsWith("```")) inCode = !inCode;
    else if (!inCode && /^#{1,3}\s/.test(line)) break;
    section.push(line);
  }
  return section.join("\n");
}

describe("GH-55 · E3 — la documentación describe el instalador", () => {
  it.each([
    { name: "README §1.4", file: README, heading: /^### \*\*1\.4\. Instrucciones de instalación/ },
    { name: "docs/001 §1.4", file: DOC_001, heading: /^### \*\*1\.4\. Instrucciones de instalación/ },
    { name: "docs/002 §2.4", file: DOC_002, heading: /^### \*\*2\.4\. Infraestructura y despliegue/ },
  ])("$name menciona scripts/install.ps1", ({ file, heading }) => {
    const section = readSection(file, heading);
    expect(section.trim()).not.toBe("");
    expect(section).toContain("install.ps1");
  });

  it("docs/001 explica en «Actualizar» que el instalador también actualiza", () => {
    const actualizar = read(DOC_001).split("**Actualizar**")[1]?.split("**Si algo falla**")[0] ?? "";
    expect(actualizar).toContain("install.ps1");
  });

  it("docs/002 §2.4 ya no dice que el usuario compila siempre a mano desde el clon", () => {
    const section = readSection(DOC_002, /^### \*\*2\.4\. Infraestructura y despliegue/);
    expect(section).not.toContain("el usuario compila desde el clon.");
  });

  it("CLAUDE.md menciona el instalador en «Build / test commands»", () => {
    const section = read("CLAUDE.md").split("## Build / test commands")[1] ?? "";
    expect(section).toContain("install.ps1");
  });
});

describe("GH-55 · E3 — la comprobación de la versión de Node se atribuye a quien la hace", () => {
  it.each([
    { name: "docs/002", file: DOC_002 },
    { name: "docs/009", file: DOC_009 },
  ])("$name no dice que la herramienta comprueba la versión al arrancar", ({ file }) => {
    expect(read(file)).not.toMatch(/la herramienta comprueba la versión al arrancar/i);
  });

  it.each([
    { name: "docs/002", file: DOC_002 },
    { name: "docs/009", file: DOC_009 },
  ])("$name dice en el requisito de Node ≥ 22.13 que lo comprueba el instalador", ({ file }) => {
    const lines = read(file)
      .split("\n")
      .filter((line) => line.startsWith("- Node.js ≥ 22.13"));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toContain("instalador");
  });
});

describe("GH-55 · E3 — docs/009 registra la prueba del instalador en Windows 11", () => {
  it("hay una fila del registro de cambios que habla de scripts/install.ps1 y de Windows 11", () => {
    const fila = read(DOC_009)
      .split("\n")
      .find((line) => line.startsWith("| 2026-11-") && line.includes("install.ps1"));
    expect(fila).toBeDefined();
    expect(fila).toContain("Windows 11");
  });
});
