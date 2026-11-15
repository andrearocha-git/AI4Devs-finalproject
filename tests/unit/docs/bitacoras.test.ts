import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// GH-23 — Bitácoras que faltan (issue #23). Vigila que las bitácoras de TK-03b y TK-02i den sus cifras propias de tests, que las frases
// verificables coincidan con los contratos y que `prompts.md` resuma las bitácoras. No juzga la redacción.

const ROOT = process.cwd();
const read = (file: string): string => readFileSync(join(ROOT, file), "utf8");
const BITACORAS = "docs/LIDR/bitacoras.md";

/** Texto desde la línea que cumple `heading` hasta el siguiente encabezado de cualquier nivel (las líneas dentro de bloques de código no cuentan). */
function readSection(file: string, heading: RegExp): string {
  const lines = read(file).split("\n");
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) return "";
  const section: string[] = [];
  let inCode = false;
  for (const line of lines.slice(start + 1)) {
    if (line.trimStart().startsWith("```")) inCode = !inCode;
    else if (!inCode && /^#{1,6}\s/.test(line)) break;
    section.push(line);
  }
  return section.join("\n");
}

// ---- E1: cada ticket de TK-03b y TK-02i da su cifra propia de tests ----

/** Tests que aportó cada ticket y total de la suite al fusionar su PR (medidos con los commits de fusión de las PR #13 a #16). */
const CIFRAS = [
  { ticket: "TK-03b1", propios: 53, total: 633, seccion: /^##### \*\*Resultados de Calidad Obtenidos \(TK-03b1, TK-03b2 y TK-03b3\)/ },
  { ticket: "TK-03b2", propios: 24, total: 657, seccion: /^##### \*\*Resultados de Calidad Obtenidos \(TK-03b1, TK-03b2 y TK-03b3\)/ },
  { ticket: "TK-03b3", propios: 41, total: 698, seccion: /^##### \*\*Resultados de Calidad Obtenidos \(TK-03b1, TK-03b2 y TK-03b3\)/ },
  { ticket: "TK-02i", propios: 9, total: 707, seccion: /^##### \*\*Resultados de Calidad Obtenidos \(TK-02i\)/ },
] as const;

describe.each(CIFRAS)("GH-23 · E1 — la bitácora de $ticket da su cifra propia de tests", ({ ticket, propios, total, seccion }) => {
  const texto = readSection(BITACORAS, seccion);

  it("encuentra la sección de resultados", () => {
    expect(texto.trim()).not.toBe("");
  });

  it(`dice que aportó ${propios} tests y que la suite tenía ${total} al fusionar su PR`, () => {
    const cifra = new RegExp(`${ticket}[^.\\n]{0,40}\\b${propios}\\b[^.\\n]{0,60}\\b${total}\\b`);
    expect(texto).toMatch(cifra);
  });
});

describe("GH-23 · E1 — la bitácora aclara cómo se midieron las cifras", () => {
  it("explica que son la diferencia entre los totales de los commits de fusión de cada PR", () => {
    const bitacoras = read(BITACORAS);
    expect(readSection(BITACORAS, /^##### \*\*Resultados de Calidad Obtenidos \(TK-03b1, TK-03b2 y TK-03b3\)/)).toMatch(/diferencia entre los totales/);
    expect(bitacoras).toContain("commits de fusión");
  });
});

// ---- E2: las frases verificables de las bitácoras coinciden con los contratos y con el código ----

/** Cuántos puntos numerados hay bajo «Puntos (ambiguos o asumidos) aprobados con el contrato» de un contrato. */
function puntosAprobados(contrato: string): number {
  const lines = read(`docs/changes/${contrato}.md`).split("\n");
  const start = lines.findIndex((line) => line.startsWith("Puntos **(ambiguos o asumidos)** aprobados con el contrato"));
  if (start === -1) return 0;
  let count = 0;
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    if (/^\d+\.\s/.test(line)) count += 1;
  }
  return count;
}

describe("GH-23 · E2 — «12 y 9 puntos ambiguos o asumidos» coincide con los contratos", () => {
  it("los contratos de TK-02f y TK-02h tienen 12 y 9 puntos aprobados", () => {
    expect(puntosAprobados("TK-02f")).toBe(12);
    expect(puntosAprobados("TK-02h")).toBe(9);
  });

  it("la bitácora dice exactamente esas cifras", () => {
    const frase = /con (\d+) puntos ambiguos o asumidos en TK-02f y (\d+) en TK-02h/.exec(read(BITACORAS));
    expect(frase, "no se encontró la frase de los puntos").not.toBeNull();
    expect([Number(frase?.[1]), Number(frase?.[2])]).toEqual([puntosAprobados("TK-02f"), puntosAprobados("TK-02h")]);
  });
});

describe("GH-23 · E2 — la regex del ID de TK-03b1 está alineada con el Orquestador y la bitácora lo precisa", () => {
  const ticketIdPattern = (file: string): string => /TICKET_ID_FORMAT = \/(.+)\/;/.exec(read(file))?.[1] ?? "";
  const sinGrupos = (pattern: string): string => pattern.replace(/[()]/g, "");
  const bitacora = read(BITACORAS);
  const frase = /También[^\n]*regex del ID[^\n]*/.exec(bitacora)?.[0] ?? "";

  it("la TUI valida con el mismo criterio que el Orquestador (sin contar el grupo de captura)", () => {
    const tui = ticketIdPattern("src/tui/validators.ts");
    expect(tui).not.toBe("");
    expect(sinGrupos(ticketIdPattern("src/services/orchestrator/ticket-orchestrator.ts"))).toBe(tui);
  });

  it("`docs/006` describe `isValidTicketId` con esa misma regex", () => {
    expect(read("docs/006-tickets-de-trabajo.md")).toContain(ticketIdPattern("src/tui/validators.ts"));
  });

  it("la bitácora dice que se alineó el texto de `docs/006`, tras la revisión de la PR #12", () => {
    expect(frase).not.toBe("");
    expect(frase).toContain("docs/006");
    expect(frase).toContain("PR #12");
  });
});

describe("GH-23 · E2 — las seis bitácoras mantienen sus secciones y las fechas de las divisiones", () => {
  const bitacora = read(BITACORAS);
  const GRUPOS = ["TK-02f y TK-02h", "TK-03b1, TK-03b2 y TK-03b3", "TK-02i"];

  it.each(GRUPOS)("%s tiene sus tres secciones (gobierno, decisiones y resultados)", (grupo) => {
    for (const titulo of ["Gobierno del Agente y del flujo de entrega", "Decisiones de Arquitectura e Intervenciones", "Resultados de Calidad Obtenidos"]) {
      expect(bitacora, `falta «${titulo} (${grupo})»`).toContain(`##### **${titulo} (${grupo})**`);
    }
  });

  it("la división de TK-02f figura con su fecha, 2026-11-06, y la de TK-03b con la suya, 2026-11-12", () => {
    expect(bitacora).toMatch(/el 2026-11-06 lo dividí en TK-02f/);
    expect(bitacora).toMatch(/El 2026-11-12 lo dividí en TK-03b1/);
  });
});

// ---- E3: prompts.md resume las bitácoras de la segunda entrega ----

describe("GH-23 · E3 — prompts.md §8 resume las bitácoras", () => {
  const lines = read("prompts.md").split("\n");
  const start = lines.findIndex((line) => /^### Bitácoras de la segunda entrega/.test(line));
  const resumen = start === -1 ? "" : lines.slice(start + 1).join("\n").split(/\n#{1,3}\s/)[0] ?? "";
  const seccion8 = lines.slice(lines.findIndex((line) => /^## 8\. Segunda entrega/.test(line))).join("\n");

  it("tiene un apartado «Bitácoras de la segunda entrega» dentro de la sección 8", () => {
    expect(start).toBeGreaterThan(-1);
    expect(seccion8).toContain("### Bitácoras de la segunda entrega");
  });

  it("enlaza a `docs/LIDR/bitacoras.md` y ese archivo existe", () => {
    expect(resumen).toContain("(docs/LIDR/bitacoras.md)");
    expect(read(BITACORAS).length).toBeGreaterThan(0);
  });

  it("resume el alcance (de TK-00 a TK-02i) y qué recoge cada bitácora", () => {
    for (const dato of ["TK-00", "TK-02i"]) expect(resumen, `falta «${dato}»`).toContain(dato);
    for (const tema of [/gobierno del agente/i, /decisiones/i, /revisiones de Cursor/i, /resultados de calidad/i]) expect(resumen).toMatch(tema);
  });
});
