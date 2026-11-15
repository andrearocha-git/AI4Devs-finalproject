import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// GH-24 — Cierre del Hito 3 en la documentación (issue #24). Vigila que el backlog, `docs/009` y el `README` cuenten el estado real del
// hito: la suite actual, los pasos que ya funcionan y las comprobaciones hechas. No juzga la redacción.

const ROOT = process.cwd();
const read = (file: string): string => readFileSync(join(ROOT, file), "utf8");

// ---- E1: el backlog refleja el Hito 3 hecho ----

const BACKLOG = "docs/LIDR/backlog-2da-entrega.md";

describe("GH-24 · E1 — el backlog refleja el Hito 3 hecho", () => {
  const lines = read(BACKLOG).split("\n");
  const row = (prefix: string): string => lines.find((line) => line.startsWith(prefix)) ?? "";
  const estado = row("Estado:");

  it("la línea «Estado» da la suite actual: 36 archivos y 829 tests, no 731", () => {
    expect(estado).not.toBe("");
    expect(estado).toContain("36 archivos");
    expect(estado).toContain("829 tests");
    expect(estado).not.toContain("731 tests");
  });

  it("la línea «Estado» ya no dice que TK-02i esté pendiente de la revisión de Cursor", () => {
    expect(estado).not.toMatch(/pendiente de la revisión de Cursor/);
  });

  it("la línea «Estado» nombra GH-20, GH-23 y GH-44 y dice que el Hito 3 está cerrado y probado en Windows 11", () => {
    for (const id of ["GH-20", "GH-23", "GH-44"]) expect(estado, `falta «${id}»`).toContain(id);
    expect(estado).toMatch(/Hito 3[^.;]*cerrado/);
    expect(estado).toContain("Windows 11");
  });

  it("la fila 3.1 figura hecha y dice qué se comprobó a mano (US-01 CA6) y qué solo con tests (US-02 CA3)", () => {
    const fila = row("| 3.1 |");
    expect(fila).not.toBe("");
    expect(fila).toContain("✅");
    expect(fila).toMatch(/US-01 CA6[^|]*#20/);
    expect(fila).toMatch(/US-02 CA3[^|]*tests/);
  });

  it("la fila 3.6 figura hecha, con la cobertura medida y la revisión del diff completo (#21 y #22)", () => {
    const fila = row("| 3.6 |");
    expect(fila).not.toBe("");
    expect(fila).toContain("✅");
    expect(fila).toContain("98,97");
    for (const issue of ["#21", "#22"]) expect(fila, `falta «${issue}»`).toContain(issue);
  });
});

// ---- E2: docs/009 marca como implementados los pasos que ya funcionan ----

const FLUJO = "docs/009-flujo-funcional.md";

describe("GH-24 · E2 — docs/009 marca como implementados los pasos que ya funcionan", () => {
  const lines = read(FLUJO).split("\n");
  const heading = (paso: string): string => lines.find((line) => line.startsWith(`### ${paso} `)) ?? "";

  it.each(["5.1", "5.4"])("el paso %s figura «Implementado y probado», ya no «Especificado»", (paso) => {
    const linea = heading(paso);
    expect(linea, `no se encontró el paso ${paso}`).not.toBe("");
    expect(linea).toContain("✅ Implementado y probado");
    expect(linea).not.toContain("📄 Especificado");
  });

  it("el paso 5.1 cita su límite conocido (#50: el upsert pisa una ejecución correcta) y la verificación en #20", () => {
    const linea = heading("5.1");
    expect(linea).toContain("#50");
    expect(linea).toContain("#20");
  });

  it("el paso 5.4 cita sus límites conocidos (#49 y #51) y la verificación en #20", () => {
    const linea = heading("5.4");
    for (const issue of ["#49", "#51", "#20"]) expect(linea, `falta «${issue}»`).toContain(issue);
  });

  it("los pasos que siguen fuera de la herramienta o sin implementar no cambian (5.3 y 1.1 siguen «Especificado»)", () => {
    expect(heading("5.3")).toContain("📄 Especificado");
    expect(heading("1.1")).toContain("📄 Especificado");
  });

  it("el registro de cambios tiene una entrada del 2026-11-15 que anota el cierre del Hito 3 (#24)", () => {
    const entrada = lines.find((line) => line.startsWith("| 2026-11-15 |") && line.includes("#24")) ?? "";
    expect(entrada).not.toBe("");
    expect(entrada).toContain("Hito 3");
    for (const issue of ["5.1", "5.4"]) expect(entrada, `falta «${issue}»`).toContain(issue);
  });
});

// ---- E3: el README da la cifra de tests actual ----

describe("GH-24 · E3 — el README da la cifra de tests actual", () => {
  const readme = read("README.md");
  const inicio = readme.search(/^### \*\*2\.6\. Tests/m);
  const seccion = inicio === -1 ? "" : (readme.slice(inicio).split(/\n#{1,3}\s/)[1] === undefined ? readme.slice(inicio) : readme.slice(inicio).split(/\n## /)[0] ?? "");
  const archivosDeTest = (readdirSync(join(ROOT, "tests"), { recursive: true }) as string[]).filter((f) => f.endsWith(".test.ts")).length;

  it("encuentra la sección 2.6", () => {
    expect(seccion.trim()).not.toBe("");
  });

  it("dice cuántos archivos de test hay y coincide con los reales de `tests/`", () => {
    const dicho = /(\d+) archivos y (\d+) tests en verde/.exec(seccion);
    expect(dicho, "no se encontró «N archivos y M tests en verde»").not.toBeNull();
    expect(Number(dicho?.[1])).toBe(archivosDeTest);
  });

  it("dice 829 tests en verde, no los 793 anteriores", () => {
    expect(seccion).toContain("829 tests en verde");
    expect(seccion).not.toContain("793 tests");
  });

  it("no dice que el Hito 3 esté pendiente", () => {
    expect(readme).not.toMatch(/Hito 3[^.\n]*(pendiente|en curso|sin cerrar)/i);
  });
});
