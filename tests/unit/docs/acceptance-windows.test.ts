import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// GH-20 — Registro de la prueba de aceptación en Windows (issue #20). La prueba la hizo el desarrollador a mano el 2026-11-15;
// estos tests solo vigilan que la documentación refleje su resultado y no vuelva a decir que está pendiente. No juzgan la redacción.

const ROOT = process.cwd();
const read = (file: string): string => readFileSync(join(ROOT, file), "utf8");

// ---- E1: README §1.4 y docs/001 §1.4 declaran verificado el uso completo ----

const INSTALL_DOCS = [
  { name: "README.md §1.4", file: "README.md" },
  { name: "docs/001 §1.4", file: "docs/001-descripcion-general-del-producto.md" },
] as const;

/**
 * Devuelve el texto de la sección que empieza en el encabezado indicado, hasta el siguiente encabezado de nivel 1 a 3.
 * Las líneas dentro de bloques de código (``` ... ```) no cuentan como encabezados.
 */
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

describe.each(INSTALL_DOCS)("GH-20 · E1 — $name declara verificado el uso completo", ({ file }) => {
  const section = readSection(file, /^### \*\*1\.4\. Instrucciones de instalación/);

  it("encuentra la sección 1.4", () => {
    expect(section.trim()).not.toBe("");
  });

  it("ya no dice que el uso completo está pendiente en el issue #20", () => {
    expect(section).not.toMatch(/pendiente[^\n]*#20/);
    expect(section).not.toMatch(/#20[^\n]*pendiente/);
  });

  it("dice que se verificó en Windows 11 el 2026-11-15, y no «probado en Windows 10»", () => {
    expect(section).toContain("Windows 11");
    expect(section).toContain("2026-11-15");
    expect(section).not.toMatch(/(verificad|probad)[oa]s?[^\n.]*Windows 10(?!\/)/);
  });

  it("nombra los dos desvíos de la prueba: repositorios de prueba y el Ollama de WSL", () => {
    expect(section).toMatch(/repositorios de prueba/);
    expect(section).toMatch(/Ollama de WSL/);
  });

  it("aclara que Windows 10 no se probó", () => {
    expect(section).toMatch(/Windows 10[^\n.]*(no se probó|sin probar)/);
  });
});

// ---- E2: docs/009 deja de remitir al #20 y registra el resultado ----

const FLUJO = "docs/009-flujo-funcional.md";

/** Frases con las que `docs/009` aplazaba pruebas a la aceptación en Windows (issue #20 / Hito 3). */
const APLAZADO = /se prueba en el issue #20|queda para la aceptación del Hito 3|se comprueban en la aceptación del Hito 3|aún no con el Jira real/;

describe.each(["1.2", "1.3", "1.4", "2.1", "2.2", "2.4", "5.2"])("GH-20 · E2 — el paso %s de docs/009", (paso) => {
  const section = readSection(FLUJO, new RegExp(`^### ${paso.replace(".", "\\.")} `));
  const heading = read(FLUJO).split("\n").find((line) => line.startsWith(`### ${paso} `)) ?? "";

  it("existe", () => {
    expect(`${heading}${section}`.trim()).not.toBe("");
  });

  it("ya no aplaza pruebas a la aceptación en Windows", () => {
    expect(`${heading}\n${section}`).not.toMatch(APLAZADO);
  });
});

describe("GH-20 · E2 — hueco H-05 y registro de cambios de docs/009", () => {
  const lines = read(FLUJO).split("\n");
  const row = (prefix: string): string => lines.find((line) => line.startsWith(prefix)) ?? "";

  it("la fila de H-05 ya no dice que falta el uso completo", () => {
    const h05 = row("| **H-05**");
    expect(h05).not.toBe("");
    expect(h05).not.toMatch(/falta el uso completo/);
  });

  it("la entrada del 2026-11-14 sobre el issue #19 dice Windows 11, no «Prueba en Windows 10»", () => {
    const entrada = row("| 2026-11-14 | Prueba en Windows");
    expect(entrada).not.toBe("");
    expect(entrada).toContain("Windows 11");
    expect(entrada).not.toContain("Prueba en Windows 10");
  });

  it("hay una entrada del 2026-11-15 sobre el issue #20 con el entorno, los desvíos y los hallazgos", () => {
    const entrada = row("| 2026-11-15 |");
    expect(entrada).not.toBe("");
    for (const dato of ["#20", "Windows 11", "repositorios de prueba", "Ollama de WSL", "#39", "#44", "ANSI"]) {
      expect(entrada, `falta «${dato}»`).toContain(dato);
    }
    expect(entrada).toMatch(/Windows 10[^|.]*(no se probó|sin probar)/);
  });
});

// ---- E3: el backlog y CLAUDE.md reflejan la prueba hecha ----

describe("GH-20 · E3 — el backlog de la 2.ª entrega refleja la prueba hecha", () => {
  const lines = read("docs/LIDR/backlog-2da-entrega.md").split("\n");
  const row = (prefix: string): string => lines.find((line) => line.startsWith(prefix)) ?? "";

  it("la línea «Estado» ya no dice que falta el uso completo", () => {
    const estado = row("Estado:");
    expect(estado).not.toBe("");
    expect(estado).not.toMatch(/falta el uso completo/);
  });

  it("la fila 3.2 ya no dice que falta el uso completo", () => {
    const fila = row("| 3.2 |");
    expect(fila).not.toBe("");
    expect(fila).not.toMatch(/falta el uso completo/);
  });

  it("la fila 3.5 figura hecha (✅) el 2026-11-15, en Windows 11, con la referencia al #20 y sin «falta»", () => {
    const fila = row("| 3.5 |");
    expect(fila).not.toBe("");
    expect(fila).toContain("2026-11-15");
    expect(fila).toContain("Windows 11");
    expect(fila).toContain("#20");
    expect(fila).not.toMatch(/falta el recorrido/);
    expect(fila.match(/✅/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("GH-20 · E3 — CLAUDE.md refleja la prueba hecha", () => {
  const linea = read("CLAUDE.md").split("\n").find((l) => l.startsWith("- Install the built CLI")) ?? "";

  it("encuentra la línea de instalación del `devflow` en «Build / test commands»", () => {
    expect(linea).not.toBe("");
  });

  it("ya no dice que el uso completo es «todavía» la prueba de aceptación", () => {
    expect(linea).not.toMatch(/still the Hito 3 acceptance test/);
  });

  it("dice Windows 11 (y no «checked on Windows 10») y el 2026-11-15", () => {
    expect(linea).toContain("Windows 11");
    expect(linea).toContain("2026-11-15");
    expect(linea).not.toMatch(/checked on Windows 10/);
  });
});
