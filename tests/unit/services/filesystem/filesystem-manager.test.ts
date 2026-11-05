import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as fsPromises from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalFileStorage, type FileOps } from "../../../../src/database/local-file-storage.js";
import { FileSystemManager } from "../../../../src/services/filesystem/filesystem-manager.js";
import type { DocumentoFase1 } from "../../../../src/shared/types/documento-fase1.types.js";

const roots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "devflow-fs-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** Operaciones de disco reales que además registran cada carpeta creada y, opcionalmente, fallan en las rutas que cumplan `failOn`. */
function recordingOps(failOn?: { when: (path: string) => boolean; code: string }): { ops: FileOps; created: string[] } {
  const created: string[] = [];
  const ops: FileOps = {
    ...fsPromises,
    mkdir: (async (path: string, options?: { recursive?: boolean }) => {
      if (failOn?.when(path)) throw Object.assign(new Error(`${failOn.code}: simulado`), { code: failOn.code });
      created.push(path);
      return fsPromises.mkdir(path, options);
    }) as FileOps["mkdir"],
  };
  return { ops, created };
}

function manager(root: string, ops?: FileOps, adjuntosDirName = "adjuntos"): FileSystemManager {
  return new FileSystemManager({ ticketsRootPath: root, adjuntosDirName }, new LocalFileStorage(ops));
}

describe("E1 — createTicketWorkspace: carpetas fuera del repositorio y errores de permisos (TK-02d US-03 CA1/CA7 en disco, DoD-a, DoD-c)", () => {
  it("con repositorio crea <raíz>/<ID>/<repo>/adjuntos y devuelve la carpeta y la ruta del documento", async () => {
    const root = tempRoot();

    const result = await manager(root).createTicketWorkspace({ ticketId: "SCRUM-1", repositoryName: "backend" });

    expect(result).toEqual({
      kind: "Ok",
      value: { folderPath: join(root, "SCRUM-1", "backend"), documentPath: join(root, "SCRUM-1", "backend", "SCRUM-1.md") },
    });
    expect(readdirSync(join(root, "SCRUM-1", "backend"))).toEqual(["adjuntos"]);
  });

  it("el nombre de la subcarpeta de evidencias sale de adjuntosDirName", async () => {
    const root = tempRoot();

    await manager(root, undefined, "evidencias").createTicketWorkspace({ ticketId: "SCRUM-1", repositoryName: "backend" });

    expect(readdirSync(join(root, "SCRUM-1", "backend"))).toEqual(["evidencias"]);
  });

  it("sin repositorio crea solo <raíz>/<ID> (sin subcarpeta de repositorio ni adjuntos) y el documento cuelga de esa carpeta", async () => {
    const root = tempRoot();

    const result = await manager(root).createTicketWorkspace({ ticketId: "SCRUM-2" });

    expect(result).toEqual({
      kind: "Ok",
      value: { folderPath: join(root, "SCRUM-2"), documentPath: join(root, "SCRUM-2", "SCRUM-2.md") },
    });
    expect(readdirSync(join(root, "SCRUM-2"))).toEqual([]);
  });

  it("repetirlo es idempotente y no borra lo que ya había en la carpeta de adjuntos", async () => {
    const root = tempRoot();
    const fs = manager(root);
    await fs.createTicketWorkspace({ ticketId: "SCRUM-1", repositoryName: "backend" });
    const evidence = join(root, "SCRUM-1", "backend", "adjuntos", "captura.png");
    writeFileSync(evidence, "binario");

    const again = await fs.createTicketWorkspace({ ticketId: "SCRUM-1", repositoryName: "backend" });

    expect(again.kind).toBe("Ok");
    expect(readdirSync(join(root, "SCRUM-1", "backend", "adjuntos"))).toEqual(["captura.png"]);
  });

  it("toda carpeta creada cuelga de la raíz de tickets recibida (nada dentro de un repositorio)", async () => {
    const root = tempRoot();
    const { ops, created } = recordingOps();

    await manager(root, ops).createTicketWorkspace({ ticketId: "SCRUM-1", repositoryName: "backend" });

    expect(created.length).toBeGreaterThan(0);
    expect(created.every((path) => path.startsWith(root + sep))).toBe(true);
  });

  it.each([
    { ticketId: "..", repositoryName: "backend" },
    { ticketId: ".", repositoryName: "backend" },
    { ticketId: "", repositoryName: "backend" },
    { ticketId: "../fuera", repositoryName: "backend" },
    { ticketId: "SCRUM-1/otro", repositoryName: "backend" },
    { ticketId: "SCRUM-1\\otro", repositoryName: "backend" },
    { ticketId: "SCRUM-1", repositoryName: ".." },
    { ticketId: "SCRUM-1", repositoryName: "" },
    { ticketId: "SCRUM-1", repositoryName: "../fuera" },
    { ticketId: "SCRUM-1", repositoryName: "a/b" },
    { ticketId: "SCRUM-1", repositoryName: "a\\b" },
  ])("segmento no válido ($ticketId / $repositoryName) → ErrorInesperado sin crear nada", async (input) => {
    const root = tempRoot();
    const { ops, created } = recordingOps();

    const result = await manager(root, ops).createTicketWorkspace(input);

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(created).toEqual([]);
    expect(readdirSync(root)).toEqual([]);
  });

  it("sin permisos para crear la carpeta de adjuntos → PermisosInsuficientes que dice qué ruta falló y qué se alcanzó a crear", async () => {
    const root = tempRoot();
    const { ops } = recordingOps({ when: (path) => path.endsWith("adjuntos"), code: "EACCES" });

    const result = await manager(root, ops).createTicketWorkspace({ ticketId: "SCRUM-1", repositoryName: "backend" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "PermisosInsuficientes" });
    if (result.kind !== "ErrorBloqueante") return;
    expect(result.message).toContain(join(root, "SCRUM-1", "backend", "adjuntos"));
    expect(result.message).toContain(join(root, "SCRUM-1", "backend"));
  });

  it("sin permisos desde la primera carpeta → PermisosInsuficientes que dice que no se alcanzó a crear nada", async () => {
    const root = tempRoot();
    const { ops } = recordingOps({ when: () => true, code: "EPERM" });

    const result = await manager(root, ops).createTicketWorkspace({ ticketId: "SCRUM-1", repositoryName: "backend" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "PermisosInsuficientes" });
    if (result.kind !== "ErrorBloqueante") return;
    expect(result.message).toMatch(/nada/i);
  });

  it.each(["EACCES", "EPERM", "EROFS"])("el código %s se clasifica como PermisosInsuficientes", async (code) => {
    const root = tempRoot();
    const { ops } = recordingOps({ when: () => true, code });

    const result = await manager(root, ops).createTicketWorkspace({ ticketId: "SCRUM-1" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "PermisosInsuficientes" });
  });

  it("otro fallo de disco (disco lleno) → ErrorInesperado, no PermisosInsuficientes", async () => {
    const root = tempRoot();
    const { ops } = recordingOps({ when: () => true, code: "ENOSPC" });

    const result = await manager(root, ops).createTicketWorkspace({ ticketId: "SCRUM-1" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
  });
});


const INICIO = "<!-- DEVFLOW:FASE1:INICIO -->";
const FIN = "<!-- DEVFLOW:FASE1:FIN -->";

const ENCABEZADO = {
  ticketId: "SCRUM-7",
  titulo: "Guardar el formulario",
  jiraUrl: "https://acme.atlassian.net/browse/SCRUM-7",
  desarrollador: "Andrea Rocha",
  fecha: "05/11/2026",
  proyecto: "SCRUM",
};

const HISTORIA: DocumentoFase1 = {
  resumen: "Permitir guardar el formulario de liquidación.",
  escenarios: [{ titulo: "Guardado correcto", given: "un formulario válido", when: "se pulsa Guardar", then: "se muestra la confirmación" }],
  preguntasAbiertas: ["¿Qué pasa con los campos opcionales?"],
  historiaUsuario: { como: "analista", quiero: "guardar el formulario", para: "no perder los datos" },
  casosDeUso: ["Guardar un borrador"],
  generatedByOllama: true,
  promptVersion: "1",
};

const BUG: DocumentoFase1 = {
  resumen: "El botón Guardar no responde.",
  escenarios: [{ titulo: "Guardar responde", given: "un formulario válido", when: "se pulsa Guardar", then: "se guarda" }],
  preguntasAbiertas: ["¿Ocurre en todos los navegadores?"],
  pasosParaReproducir: ["Abrir el formulario", "Pulsar Guardar"],
  comportamientoActual: "No pasa nada al pulsar.",
  comportamientoEsperado: "Se guarda y se confirma.",
  entorno: "Producción, Chrome 130",
  generatedByOllama: true,
  promptVersion: "1",
};

/** Parte del documento entre los marcadores de Fase 1 (sin ellos). */
function fase1Block(document: string): string {
  return document.slice(document.indexOf(INICIO) + INICIO.length, document.indexOf(FIN));
}

describe("E2 — writeDocument: Fase 1 + Fase 2 según el tipo, con o sin Ollama (TK-02d US-03 CA1/CA4 en disco, DoD-b)", () => {
  async function write(root: string, input: Partial<Parameters<FileSystemManager["writeDocument"]>[0]> = {}, ops?: FileOps) {
    const documentPath = join(root, "SCRUM-7", "backend", "SCRUM-7.md");
    const result = await manager(root, ops).writeDocument({
      documentPath,
      tipo: "historia",
      fase1: HISTORIA,
      repo: "backend",
      rama: "features/SCRUM-7-AROCHA",
      encabezado: ENCABEZADO,
      regenerateFase1Only: false,
      ...input,
    });
    return { result, documentPath };
  }

  it("historia: escribe el documento con encabezado, Fase 1 entre marcadores y las secciones propias de historia", async () => {
    const root = tempRoot();

    const { result, documentPath } = await write(root);

    expect(result).toEqual({ kind: "Ok", value: { documentPath } });
    const document = readFileSync(documentPath, "utf8");
    expect(document).toContain("[SCRUM-7](https://acme.atlassian.net/browse/SCRUM-7)");
    expect(document).toContain("Guardar el formulario");
    expect(document).toContain("Andrea Rocha");
    expect(document).toContain("05/11/2026");
    expect(document).toContain("features/SCRUM-7-AROCHA");
    expect(document).toContain("☐ Bug  ☑ Feature");
    expect(document.indexOf(INICIO)).toBeGreaterThan(-1);
    expect(document.indexOf(FIN)).toBeGreaterThan(document.indexOf(INICIO));
    const block = fase1Block(document);
    expect(block).toContain("Permitir guardar el formulario de liquidación.");
    expect(block).toContain("analista");
    expect(block).toContain("guardar el formulario");
    expect(block).toContain("no perder los datos");
    expect(block).toMatch(/CA1: Guardado correcto/);
    expect(block).toContain("un formulario válido");
    expect(block).toContain("se pulsa Guardar");
    expect(block).toContain("se muestra la confirmación");
    expect(block).toContain("Guardar un borrador");
    expect(block).toContain("¿Qué pasa con los campos opcionales?");
    expect(document).not.toContain("Qué falla");
    expect(document).not.toContain("Cómo reproducir");
  });

  it("bug: lleva Qué falla, Cómo reproducir numerado y el entorno, y marca el tipo Bug", async () => {
    const root = tempRoot();

    const { documentPath } = await write(root, { tipo: "bug", fase1: BUG });

    const document = readFileSync(documentPath, "utf8");
    expect(document).toContain("☑ Bug  ☐ Feature");
    const block = fase1Block(document);
    expect(block).toContain("Qué falla");
    expect(block).toContain("No pasa nada al pulsar.");
    expect(block).toContain("Se guarda y se confirma.");
    expect(block).toContain("Producción, Chrome 130");
    expect(block).toMatch(/1\. Abrir el formulario/);
    expect(block).toMatch(/2\. Pulsar Guardar/);
    expect(block).toContain("¿Ocurre en todos los navegadores?");
    expect(document).not.toContain("User Story");
  });

  it("la Fase 2 de la plantilla de la desarrolladora queda fuera de los marcadores y vacía", async () => {
    const root = tempRoot();

    const { documentPath } = await write(root);

    const document = readFileSync(documentPath, "utf8");
    const afterFin = document.slice(document.indexOf(FIN));
    for (const text of [
      "FASE 2",
      "Datos del desarrollo",
      "Stored Procedures / Scripts SQL",
      "Backend (Java/Spring Boot)",
      "Frontend (Angular)",
      "Evidencias",
      "Pruebas unitarias",
      "Observaciones",
    ]) {
      expect(afterFin).toContain(text);
      expect(document.slice(0, document.indexOf(INICIO))).not.toContain(text);
    }
  });

  it.each(["bug", "historia"] as const)("con { rawText } (%s) el bloque lleva el aviso «Generado sin Ollama» y el texto crudo", async (tipo) => {
    const root = tempRoot();

    const { result, documentPath } = await write(root, { tipo, fase1: { rawText: "Texto original del ticket" } });

    expect(result.kind).toBe("Ok");
    const block = fase1Block(readFileSync(documentPath, "utf8"));
    expect(block).toContain("⚠️ Generado sin Ollama");
    expect(block).toContain("Texto original del ticket");
  });

  it("un documento estructurado no lleva el aviso de «Generado sin Ollama»", async () => {
    const root = tempRoot();

    const { documentPath } = await write(root);

    expect(readFileSync(documentPath, "utf8")).not.toContain("Generado sin Ollama");
  });

  it("no escapa comillas, ángulos ni ampersands del texto (es Markdown, no HTML)", async () => {
    const root = tempRoot();

    const { documentPath } = await write(root, { fase1: { ...HISTORIA, resumen: "El botón 'Guardar' falla si x < 5 & y > 2" } });

    expect(readFileSync(documentPath, "utf8")).toContain("El botón 'Guardar' falla si x < 5 & y > 2");
  });

  it("sin encabezado, repositorio ni rama escribe el documento con los datos en blanco y sin «undefined»", async () => {
    const root = tempRoot();

    const { result, documentPath } = await write(root, { encabezado: undefined, repo: undefined, rama: undefined });

    expect(result.kind).toBe("Ok");
    const document = readFileSync(documentPath, "utf8");
    expect(document).not.toContain("undefined");
    expect(document).toContain("FASE 1");
  });

  it("si el documento ya existe y no se pide regenerar, no se toca y devuelve Ok", async () => {
    const root = tempRoot();
    const { documentPath } = await write(root);
    writeFileSync(documentPath, "contenido que ya completó la desarrolladora");

    const again = await write(root, { fase1: { ...HISTORIA, resumen: "otro resumen" } });

    expect(again.result).toEqual({ kind: "Ok", value: { documentPath } });
    expect(readFileSync(documentPath, "utf8")).toBe("contenido que ya completó la desarrolladora");
  });

  it("sin permisos para escribir el documento → PermisosInsuficientes con la ruta", async () => {
    const root = tempRoot();
    const ops: FileOps = {
      ...fsPromises,
      writeFile: (async () => {
        throw Object.assign(new Error("EACCES"), { code: "EACCES" });
      }) as FileOps["writeFile"],
    };

    const { result, documentPath } = await write(root, {}, ops);

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "PermisosInsuficientes" });
    if (result.kind !== "ErrorBloqueante") return;
    expect(result.message).toContain(documentPath);
  });

  it("si falta la plantilla del tipo → ErrorInesperado, no excepción", async () => {
    const root = tempRoot();
    const ops: FileOps = {
      ...fsPromises,
      readFile: (async () => {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }) as FileOps["readFile"],
    };

    const { result } = await write(root, {}, ops);

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
  });
});

describe("E3 — Fase 1 reutilizable y regeneración que preserva la Fase 2 (TK-02d CA4, US-03 CA6/CA9 en disco)", () => {
  const fase1Path = (root: string, ticketId = "SCRUM-7") => join(root, ticketId, ".devflow", "fase1.json");

  async function writeDoc(
    fs: FileSystemManager,
    documentPath: string,
    fase1: DocumentoFase1 | { rawText: string },
    regenerateFase1Only: boolean,
    repo = "backend",
  ) {
    return fs.writeDocument({ documentPath, tipo: "historia", fase1, repo, encabezado: ENCABEZADO, regenerateFase1Only });
  }

  it("saveFase1 escribe <raíz>/<ID>/.devflow/fase1.json y readFase1 devuelve lo mismo", async () => {
    const root = tempRoot();
    const fs = manager(root);

    const saved = await fs.saveFase1("SCRUM-7", HISTORIA);
    const read = await fs.readFase1("SCRUM-7");

    expect(saved).toEqual({ kind: "Ok", value: undefined });
    expect(JSON.parse(readFileSync(fase1Path(root), "utf8"))).toEqual(HISTORIA);
    expect(read).toEqual({ kind: "Ok", value: HISTORIA });
  });

  it("readFase1 sin fase1.json (ticket nuevo) → Ok(null), sin crear nada", async () => {
    const root = tempRoot();

    const read = await manager(root).readFase1("SCRUM-7");

    expect(read).toEqual({ kind: "Ok", value: null });
    expect(readdirSync(root)).toEqual([]);
  });

  it.each([
    { caso: "JSON corrupto", content: "{ no es json" },
    { caso: "JSON que no es un objeto", content: "[1, 2, 3]" },
    { caso: "objeto sin la forma de DocumentoFase1", content: JSON.stringify({ resumen: "solo esto" }) },
    { caso: "campos con el tipo equivocado", content: JSON.stringify({ ...HISTORIA, escenarios: "no es una lista" }) },
  ])("readFase1 con $caso → ErrorInesperado, no excepción", async ({ content }) => {
    const root = tempRoot();
    const fs = manager(root);
    await fs.saveFase1("SCRUM-7", HISTORIA);
    writeFileSync(fase1Path(root), content);

    const read = await fs.readFase1("SCRUM-7");

    expect(read).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
  });

  it("readFase1 sin permisos de lectura → PermisosInsuficientes", async () => {
    const root = tempRoot();
    await manager(root).saveFase1("SCRUM-7", HISTORIA);
    const ops: FileOps = {
      ...fsPromises,
      readFile: (async () => {
        throw Object.assign(new Error("EACCES"), { code: "EACCES" });
      }) as FileOps["readFile"],
    };

    const read = await manager(root, ops).readFase1("SCRUM-7");

    expect(read).toMatchObject({ kind: "ErrorBloqueante", subtype: "PermisosInsuficientes" });
  });

  it("readFase1 y saveFase1 con un ID que intenta salir de la raíz → ErrorInesperado sin tocar el disco", async () => {
    const root = tempRoot();
    const fs = manager(root);

    const read = await fs.readFase1("../fuera");
    const saved = await fs.saveFase1("../fuera", HISTORIA);

    expect(read).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(saved).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(readdirSync(root)).toEqual([]);
  });

  it("saveFase1 sin permisos → PermisosInsuficientes", async () => {
    const root = tempRoot();
    const ops: FileOps = {
      ...fsPromises,
      writeFile: (async () => {
        throw Object.assign(new Error("EACCES"), { code: "EACCES" });
      }) as FileOps["writeFile"],
    };

    const saved = await manager(root, ops).saveFase1("SCRUM-7", HISTORIA);

    expect(saved).toMatchObject({ kind: "ErrorBloqueante", subtype: "PermisosInsuficientes" });
  });

  it("regenerar reemplaza solo el bloque de Fase 1 y deja byte a byte igual el encabezado y lo que la desarrolladora completó en la Fase 2", async () => {
    const root = tempRoot();
    const fs = manager(root);
    const documentPath = join(root, "SCRUM-7", "backend", "SCRUM-7.md");
    await writeDoc(fs, documentPath, HISTORIA, false);
    const original = readFileSync(documentPath, "utf8");
    const edited = original
      .replace("| **PR #** | |", "| **PR #** | 1234 |")
      .replace("| **Tablas (creadas/modificadas)** | |", "| **Tablas (creadas/modificadas)** | LIQ_PAGOS |")
      .replace("<!-- Opcional: deuda técnica, riesgos, pendientes -->", "Falta revisar el índice de LIQ_PAGOS.");
    expect(edited).not.toBe(original);
    writeFileSync(documentPath, edited);

    const result = await writeDoc(fs, documentPath, { ...HISTORIA, resumen: "Resumen NUEVO tras reprocesar." }, true);

    expect(result).toEqual({ kind: "Ok", value: { documentPath } });
    const after = readFileSync(documentPath, "utf8");
    expect(fase1Block(after)).toContain("Resumen NUEVO tras reprocesar.");
    expect(fase1Block(after)).not.toContain("Permitir guardar el formulario de liquidación.");
    expect(after.slice(0, after.indexOf(INICIO))).toBe(edited.slice(0, edited.indexOf(INICIO)));
    expect(after.slice(after.indexOf(FIN))).toBe(edited.slice(edited.indexOf(FIN)));
    expect(after).toContain("LIQ_PAGOS");
    expect(after).toContain("1234");
    expect(after).toContain("Falta revisar el índice de LIQ_PAGOS.");
  });

  it("regenerar con { rawText } deja el aviso «Generado sin Ollama» en el bloque y respeta la Fase 2", async () => {
    const root = tempRoot();
    const fs = manager(root);
    const documentPath = join(root, "SCRUM-7", "backend", "SCRUM-7.md");
    await writeDoc(fs, documentPath, HISTORIA, false);
    writeFileSync(documentPath, readFileSync(documentPath, "utf8").replace("| **Otros** | Config, dependencias, etc. |", "| **Otros** | Flyway V12 |"));

    const result = await writeDoc(fs, documentPath, { rawText: "Texto crudo del ticket" }, true);

    expect(result.kind).toBe("Ok");
    const after = readFileSync(documentPath, "utf8");
    expect(fase1Block(after)).toContain("⚠️ Generado sin Ollama");
    expect(fase1Block(after)).toContain("Texto crudo del ticket");
    expect(after).toContain("Flyway V12");
  });

  it("regenerar un documento sin marcadores → ErrorInesperado y el archivo queda intacto", async () => {
    const root = tempRoot();
    const fs = manager(root);
    const documentPath = join(root, "SCRUM-7", "backend", "SCRUM-7.md");
    await fs.createTicketWorkspace({ ticketId: "SCRUM-7", repositoryName: "backend" });
    writeFileSync(documentPath, "# Documento sin marcadores\n\nTexto de la desarrolladora.\n");

    const result = await writeDoc(fs, documentPath, HISTORIA, true);

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(readFileSync(documentPath, "utf8")).toBe("# Documento sin marcadores\n\nTexto de la desarrolladora.\n");
  });

  it("regenerar cuando el documento aún no existe lo crea completo", async () => {
    const root = tempRoot();
    const documentPath = join(root, "SCRUM-7", "backend", "SCRUM-7.md");

    const result = await writeDoc(manager(root), documentPath, HISTORIA, true);

    expect(result.kind).toBe("Ok");
    expect(readFileSync(documentPath, "utf8")).toContain(INICIO);
  });

  it("segundo repositorio: carpeta y documento propios con la Fase 1 leída de fase1.json, sin tocar el documento del primero", async () => {
    const root = tempRoot();
    const fs = manager(root);
    const first = await fs.createTicketWorkspace({ ticketId: "SCRUM-7", repositoryName: "backend" });
    if (first.kind !== "Ok") throw new Error("setup");
    await fs.saveFase1("SCRUM-7", HISTORIA);
    await writeDoc(fs, first.value.documentPath, HISTORIA, false);
    const firstBefore = readFileSync(first.value.documentPath, "utf8");

    const stored = await fs.readFase1("SCRUM-7");
    const second = await fs.createTicketWorkspace({ ticketId: "SCRUM-7", repositoryName: "frontend" });
    if (stored.kind !== "Ok" || stored.value === null || second.kind !== "Ok") throw new Error("setup");
    const written = await writeDoc(fs, second.value.documentPath, stored.value, false, "frontend");

    expect(written.kind).toBe("Ok");
    expect(second.value.folderPath).toBe(join(root, "SCRUM-7", "frontend"));
    expect(second.value.documentPath).not.toBe(first.value.documentPath);
    const secondDocument = readFileSync(second.value.documentPath, "utf8");
    expect(fase1Block(secondDocument)).toBe(fase1Block(firstBefore));
    expect(secondDocument).toContain("| **Repositorio** | frontend |");
    expect(readFileSync(first.value.documentPath, "utf8")).toBe(firstBefore);
    expect(readdirSync(join(root, "SCRUM-7"), { withFileTypes: true }).map((e) => e.name).sort()).toEqual([".devflow", "backend", "frontend"]);
  });
});
