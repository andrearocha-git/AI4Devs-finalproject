import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SQLiteStorageManager } from "../../../../src/database/sqlite-storage-manager.js";
import { FileSystemManager } from "../../../../src/services/filesystem/filesystem-manager.js";
import type { GitManager } from "../../../../src/services/git/git-manager.js";
import { TicketOrchestrator, type JiraGateway } from "../../../../src/services/orchestrator/ticket-orchestrator.js";
import type { StepResult } from "../../../../src/shared/errors/result.types.js";
import type { Repository } from "../../../../src/shared/types/config.types.js";
import type { DocumentoFase1 } from "../../../../src/shared/types/documento-fase1.types.js";
import type { ContextoTicket } from "../../../../src/shared/types/ticket-context.types.js";
import type { AskCallback, TicketRunSummary } from "../../../../src/shared/types/ticket-run.types.js";

// TK-02h: la Fase 1 se genera una vez por ticket, se reutiliza con otro repositorio, se reprocesa con `reprocessFase1` y se reintenta
// sola si quedó sin redactar. Gestor de archivos y SQLite reales (carpetas temporales); Jira, Git y Ollama simulados.

const NOW = new Date(2026, 10, 6, 15, 30, 0);
const BUG: ContextoTicket = {
  ticketId: "SCRUM-2",
  title: "El botón Aceptar desaparece",
  description: "Al borrar el importe desaparece el botón Aceptar",
  issueType: "Error",
  source: "jira",
};

function fase1(overrides: Partial<DocumentoFase1> = {}): DocumentoFase1 {
  return {
    presenteEnTicket: { pasosParaReproducir: true },
    resumen: "Resumen generado por Ollama.",
    pasosParaReproducir: ["Borrar el importe."],
    comportamientoEsperado: "El botón sigue visible.",
    comportamientoActual: "El botón desaparece.",
    entorno: "No especificado en el ticket.",
    escenarios: [{ titulo: "Botón visible", given: "un importe", when: "se borra", then: "el botón sigue visible" }],
    preguntasAbiertas: [],
    generatedByOllama: true,
    promptVersion: "bug-v1",
    ...overrides,
  };
}

const ok = <T>(value: T): StepResult<T> => ({ kind: "Ok", value });

function setup() {
  const root = mkdtempSync(join(tmpdir(), "devflow-fase1-"));
  const storage = new SQLiteStorageManager(":memory:");
  storage.migrate();
  storage.upsertAppConfig({
    jiraBaseUrl: "https://equipo.atlassian.net",
    jiraEmail: "dev@example.com",
    jiraApiToken: "token",
    branchUserSuffix: "AROCHA",
    ticketsRootPath: root,
  });
  const project = storage.upsertJiraProject({ jiraProjectKey: "SCRUM", jiraProjectName: "Mi Team" });
  const repoA = storage.upsertRepository({ jiraProjectId: project.id, name: "api", repoLocalPath: "/work/api" });
  const repoB = storage.upsertRepository({ jiraProjectId: project.id, name: "web", repoLocalPath: "/work/web" });

  const jira = {
    fetchTicket: vi.fn(async () => ok(BUG)),
    getMyDisplayName: vi.fn(async () => ok("Andrea Rocha")),
    validateProjectKey: vi.fn(),
    listAssignedTickets: vi.fn(),
  };
  const git = {
    inspectRepository: vi.fn(async () => ok({ branchAlreadyExists: false })),
    createBranch: vi.fn(async (input: { branchName: string; baseBranch: string }) =>
      ok({ branchName: input.branchName, baseBranch: input.baseBranch, alreadyExisted: false }),
    ),
    validateRepository: vi.fn(),
  };
  const transformer = { processContext: vi.fn(async (): Promise<StepResult<DocumentoFase1>> => ok(fase1())) };
  const steps: Array<[string, string, string | undefined]> = [];
  const ask = vi.fn(async (request: { kind: string }): Promise<boolean> => request.kind === "confirmActions") as unknown as AskCallback;
  const orchestrator = new TicketOrchestrator(storage, git as unknown as GitManager, () => jira as unknown as JiraGateway, {
    createTransformer: () => transformer,
    now: () => NOW,
  });
  const start = (repo: Repository, extra: { reprocessFase1?: boolean } = {}): Promise<TicketRunSummary> =>
    orchestrator.startTicket(
      { ticketId: "SCRUM-2", repositoryId: repo.id, ...extra },
      { onStep: (step, status, detail) => steps.push([step, status, detail]), ask },
    );
  const rows = () => storage.db.prepare("SELECT * FROM ticket_logs ORDER BY id").all() as Array<Record<string, unknown>>;
  const fileSystem = new FileSystemManager({ ticketsRootPath: root, adjuntosDirName: "adjuntos" });
  const docOf = (repo: Repository): string => join(root, "SCRUM-2", repo.name, "SCRUM-2.md");
  const fase1Path = join(root, "SCRUM-2", ".devflow", "fase1.json");
  /** Simula lo que la desarrolladora completó a mano en la Fase 2 del documento. */
  const completePhase2 = (repo: Repository, text = "TRABAJO MANUAL: tablas y evidencias"): void => {
    writeFileSync(docOf(repo), `${readFileSync(docOf(repo), "utf8")}\n${text}\n`);
  };
  return { root, storage, repoA, repoB, jira, git, transformer, steps, ask, orchestrator, start, rows, fileSystem, docOf, fase1Path, completePhase2 };
}

let w: ReturnType<typeof setup>;
beforeEach(() => {
  w = setup();
});
afterEach(() => {
  w.storage.close();
  rmSync(w.root, { recursive: true, force: true });
});

describe("E1 — reutilizar la Fase 1", () => {
  it("con otro repositorio no invoca a Ollama: crea su carpeta y su documento con la misma Fase 1, y deja el de A intacto", async () => {
    w.transformer.processContext.mockResolvedValue(ok(fase1({ promptVersion: "bug-v7", resumen: "Fase 1 única del ticket." })));
    await w.start(w.repoA);
    w.completePhase2(w.repoA);
    const docABefore = readFileSync(w.docOf(w.repoA), "utf8");
    const fase1Before = readFileSync(w.fase1Path, "utf8");

    const summary = await w.start(w.repoB);

    expect(w.transformer.processContext).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ ollamaStatus: "reused", promptVersion: "bug-v7", repositoryId: w.repoB.id, branchStatus: "created" });
    expect(summary.documentPath).toBe(w.docOf(w.repoB));
    expect(existsSync(join(w.root, "SCRUM-2", "web", "adjuntos"))).toBe(true);
    expect(readFileSync(w.docOf(w.repoB), "utf8")).toContain("Fase 1 única del ticket.");
    expect(readFileSync(w.docOf(w.repoA), "utf8")).toBe(docABefore);
    expect(readFileSync(w.fase1Path, "utf8")).toBe(fase1Before);
  });

  it("registra una fila propia para B con ollama_status reused y la prompt_version de la Fase 1 reutilizada", async () => {
    w.transformer.processContext.mockResolvedValue(ok(fase1({ promptVersion: "bug-v7" })));
    await w.start(w.repoA);

    await w.start(w.repoB);

    const rows = w.rows();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.repository_id === w.repoA.id)).toMatchObject({ ollama_status: "ok", prompt_version: "bug-v7" });
    expect(rows.find((r) => r.repository_id === w.repoB.id)).toMatchObject({
      ollama_status: "reused",
      prompt_version: "bug-v7",
      branch_name: "bugs/SCRUM-2-AROCHA",
      branch_status: "created",
    });
  });

  it("emite el paso ollama como started y ok con el detalle «Fase 1 reutilizada»", async () => {
    await w.start(w.repoA);
    w.steps.length = 0;

    await w.start(w.repoB);

    const ollama = w.steps.filter(([step]) => step === "ollama");
    expect(ollama).toEqual([
      ["ollama", "started", undefined],
      ["ollama", "ok", "Fase 1 reutilizada"],
    ]);
  });

  it("con el mismo repositorio y sin reprocesar también reutiliza, y no pisa lo completado a mano", async () => {
    await w.start(w.repoA);
    w.completePhase2(w.repoA, "MI FASE 2 ESCRITA A MANO");
    const docBefore = readFileSync(w.docOf(w.repoA), "utf8");

    const summary = await w.start(w.repoA);

    expect(w.transformer.processContext).toHaveBeenCalledTimes(1);
    expect(summary.ollamaStatus).toBe("reused");
    expect(readFileSync(w.docOf(w.repoA), "utf8")).toBe(docBefore);
    expect(readFileSync(w.docOf(w.repoA), "utf8")).toContain("MI FASE 2 ESCRITA A MANO");
    expect(w.rows()).toHaveLength(1);
    expect(w.rows()[0]).toMatchObject({ ollama_status: "reused" });
  });

  it("la rama, la confirmación y el resto del flujo no cambian al reutilizar", async () => {
    await w.start(w.repoA);

    const summary = await w.start(w.repoB);

    expect(w.git.createBranch).toHaveBeenLastCalledWith({ repoLocalPath: "/work/web", branchName: "bugs/SCRUM-2-AROCHA", baseBranch: "main" });
    expect(w.ask).toHaveBeenCalledTimes(2);
    expect(summary).toMatchObject({ jiraFetchStatus: "ok", folderPath: join(w.root, "SCRUM-2", "web") });
  });
});

/** Quita el bloque de Fase 1 de un documento: lo que queda es lo que el reproceso no debe tocar. */
function outsideFase1(document: string): string {
  return document.replace(/<!-- DEVFLOW:FASE1:INICIO -->[\s\S]*<!-- DEVFLOW:FASE1:FIN -->/, "<!-- FASE1 -->");
}

describe("E2 — reprocesar la Fase 1", () => {
  /** Ticket iniciado con A y con B (Fase 1 «VIEJA», prompt bug-v7) y la Fase 2 de A completada a mano. */
  async function started() {
    w.transformer.processContext.mockResolvedValue(ok(fase1({ resumen: "Análisis VIEJO", promptVersion: "bug-v7" })));
    await w.start(w.repoA);
    await w.start(w.repoB);
    w.completePhase2(w.repoA, "FASE 2 DE A, ESCRITA A MANO");
    w.transformer.processContext.mockClear();
  }

  it("con Ollama bien: sobrescribe fase1.json y regenera solo el bloque de Fase 1 del repositorio elegido", async () => {
    await started();
    const docABefore = readFileSync(w.docOf(w.repoA), "utf8");
    const docBBefore = readFileSync(w.docOf(w.repoB), "utf8");
    w.transformer.processContext.mockResolvedValue(ok(fase1({ resumen: "Análisis NUEVO", promptVersion: "bug-v8" })));

    const summary = await w.start(w.repoA, { reprocessFase1: true });

    expect(w.transformer.processContext).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ ollamaStatus: "ok", promptVersion: "bug-v8" });
    const docA = readFileSync(w.docOf(w.repoA), "utf8");
    expect(docA).toContain("Análisis NUEVO");
    expect(docA).not.toContain("Análisis VIEJO");
    expect(JSON.parse(readFileSync(w.fase1Path, "utf8"))).toMatchObject({ resumen: "Análisis NUEVO", promptVersion: "bug-v8" });
    // Todo lo que está fuera del bloque de Fase 1 (encabezado y Fase 2 escrita a mano) queda byte a byte igual.
    expect(outsideFase1(docA)).toBe(outsideFase1(docABefore));
    expect(docA).toContain("FASE 2 DE A, ESCRITA A MANO");
    // El documento de otro repositorio no se toca.
    expect(readFileSync(w.docOf(w.repoB), "utf8")).toBe(docBBefore);
    expect(w.rows().find((r) => r.repository_id === w.repoA.id)).toMatchObject({ ollama_status: "ok", prompt_version: "bug-v8" });
  });

  it("con Ollama en fallback: conserva la Fase 1 válida anterior (fase1.json y documento intactos)", async () => {
    await started();
    const docABefore = readFileSync(w.docOf(w.repoA), "utf8");
    const fase1Before = readFileSync(w.fase1Path, "utf8");
    w.transformer.processContext.mockResolvedValue({ kind: "FallbackDeterminista", rawText: "texto crudo" });

    const summary = await w.start(w.repoA, { reprocessFase1: true });

    expect(summary).toMatchObject({ ollamaStatus: "fallback_deterministic", promptVersion: "bug-v7" });
    expect(readFileSync(w.docOf(w.repoA), "utf8")).toBe(docABefore);
    expect(readFileSync(w.fase1Path, "utf8")).toBe(fase1Before);
    expect(w.steps).toContainEqual(["ollama", "fallback", expect.stringContaining("conserva")]);
    expect(w.rows().find((r) => r.repository_id === w.repoA.id)).toMatchObject({ ollama_status: "fallback_deterministic", prompt_version: "bug-v7" });
  });

  it("reprocesar sobre un repositorio sin documento lo crea completo con la Fase 1 nueva y no toca el de los demás", async () => {
    w.transformer.processContext.mockResolvedValue(ok(fase1({ resumen: "Análisis VIEJO", promptVersion: "bug-v7" })));
    await w.start(w.repoA);
    const docABefore = readFileSync(w.docOf(w.repoA), "utf8");
    w.transformer.processContext.mockResolvedValue(ok(fase1({ resumen: "Análisis NUEVO", promptVersion: "bug-v8" })));

    const summary = await w.start(w.repoB, { reprocessFase1: true });

    expect(summary.ollamaStatus).toBe("ok");
    expect(readFileSync(w.docOf(w.repoB), "utf8")).toContain("Análisis NUEVO");
    expect(readFileSync(w.docOf(w.repoA), "utf8")).toBe(docABefore);
  });

  it("reprocesar sin Fase 1 previa se comporta como la primera generación (Ollama bien)", async () => {
    w.transformer.processContext.mockResolvedValue(ok(fase1({ resumen: "Primera generación" })));

    const summary = await w.start(w.repoA, { reprocessFase1: true });

    expect(summary).toMatchObject({ ollamaStatus: "ok", branchStatus: "created" });
    expect(readFileSync(w.docOf(w.repoA), "utf8")).toContain("Primera generación");
    expect(existsSync(w.fase1Path)).toBe(true);
  });

  it("reprocesar sin Fase 1 previa y con Ollama en fallback escribe el texto sin redactar y no guarda fase1.json", async () => {
    w.transformer.processContext.mockResolvedValue({ kind: "FallbackDeterminista", rawText: "texto crudo del ticket" });

    const summary = await w.start(w.repoA, { reprocessFase1: true });

    expect(summary.ollamaStatus).toBe("fallback_deterministic");
    expect(readFileSync(w.docOf(w.repoA), "utf8")).toContain("⚠️ Generado sin Ollama");
    expect(existsSync(w.fase1Path)).toBe(false);
  });

  it("si el documento ha perdido los marcadores de Fase 1: blocked y fase1.json como estaba (el documento se escribe antes)", async () => {
    await started();
    const fase1Before = readFileSync(w.fase1Path, "utf8");
    writeFileSync(w.docOf(w.repoA), "documento editado a mano, sin marcadores\n");
    w.transformer.processContext.mockResolvedValue(ok(fase1({ resumen: "Análisis NUEVO", promptVersion: "bug-v8" })));

    const summary = await w.start(w.repoA, { reprocessFase1: true });

    expect(summary.blocked).toMatchObject({ subtype: "ErrorInesperado" });
    expect(readFileSync(w.fase1Path, "utf8")).toBe(fase1Before);
    expect(readFileSync(w.docOf(w.repoA), "utf8")).toBe("documento editado a mano, sin marcadores\n");
  });
});

describe("E3 — reintento automático si la Fase 1 anterior quedó sin redactar", () => {
  const fallback = (): StepResult<DocumentoFase1> => ({ kind: "FallbackDeterminista", rawText: "texto crudo del ticket" });

  /** Primera ejecución con Ollama caído: documento con el aviso, sin `fase1.json`, y Fase 2 completada a mano. */
  async function firstRunWithoutOllama(): Promise<void> {
    w.transformer.processContext.mockResolvedValue(fallback());
    await w.start(w.repoA);
    w.completePhase2(w.repoA, "FASE 2 ESCRITA A MANO");
    w.transformer.processContext.mockClear();
  }

  it("tras un fallback reintenta sola: guarda fase1.json y reemplaza solo el bloque de Fase 1 (el aviso desaparece)", async () => {
    await firstRunWithoutOllama();
    const docBefore = readFileSync(w.docOf(w.repoA), "utf8");
    expect(docBefore).toContain("⚠️ Generado sin Ollama");
    w.transformer.processContext.mockResolvedValue(ok(fase1({ resumen: "Análisis logrado al reintentar" })));

    const summary = await w.start(w.repoA);

    expect(w.transformer.processContext).toHaveBeenCalledTimes(1);
    expect(summary.ollamaStatus).toBe("ok");
    const doc = readFileSync(w.docOf(w.repoA), "utf8");
    expect(doc).toContain("Análisis logrado al reintentar");
    expect(doc).not.toContain("⚠️ Generado sin Ollama");
    expect(outsideFase1(doc)).toBe(outsideFase1(docBefore));
    expect(doc).toContain("FASE 2 ESCRITA A MANO");
    expect(JSON.parse(readFileSync(w.fase1Path, "utf8"))).toMatchObject({ generatedByOllama: true, resumen: "Análisis logrado al reintentar" });
    expect(w.rows()).toHaveLength(1);
    expect(w.rows()[0]).toMatchObject({ ollama_status: "ok" });
  });

  it("si vuelve a caer a fallback deja el documento y fase1.json como estaban", async () => {
    await firstRunWithoutOllama();
    const docBefore = readFileSync(w.docOf(w.repoA), "utf8");
    w.transformer.processContext.mockResolvedValue(fallback());

    const summary = await w.start(w.repoA);

    expect(w.transformer.processContext).toHaveBeenCalledTimes(1);
    expect(summary.ollamaStatus).toBe("fallback_deterministic");
    expect(readFileSync(w.docOf(w.repoA), "utf8")).toBe(docBefore);
    expect(existsSync(w.fase1Path)).toBe(false);
  });

  it("un fase1.json guardado con generatedByOllama false no se reutiliza: reintenta y lo sobrescribe", async () => {
    await w.fileSystem.createTicketWorkspace({ ticketId: "SCRUM-2", repositoryName: "api" });
    await w.fileSystem.saveFase1("SCRUM-2", fase1({ generatedByOllama: false, resumen: "Fase 1 sin redactar" }));
    w.transformer.processContext.mockResolvedValue(ok(fase1({ resumen: "Redactada de verdad" })));

    const summary = await w.start(w.repoA);

    expect(w.transformer.processContext).toHaveBeenCalledTimes(1);
    expect(summary.ollamaStatus).toBe("ok");
    expect(JSON.parse(readFileSync(w.fase1Path, "utf8"))).toMatchObject({ generatedByOllama: true, resumen: "Redactada de verdad" });
  });

  it("un fase1.json con generatedByOllama false que sigue sin poder redactarse se deja como estaba", async () => {
    await w.fileSystem.createTicketWorkspace({ ticketId: "SCRUM-2", repositoryName: "api" });
    await w.fileSystem.saveFase1("SCRUM-2", fase1({ generatedByOllama: false, resumen: "Fase 1 sin redactar" }));
    const before = readFileSync(w.fase1Path, "utf8");
    w.transformer.processContext.mockResolvedValue(fallback());

    const summary = await w.start(w.repoA);

    expect(summary.ollamaStatus).toBe("fallback_deterministic");
    expect(readFileSync(w.fase1Path, "utf8")).toBe(before);
  });

  it.each([
    ["JSON ilegible", "{esto no es json"],
    ["JSON con otra forma", JSON.stringify({ hola: "mundo" })],
  ])("un fase1.json con %s se trata como ausente: no corta el flujo, se regenera y se sobrescribe", async (_name, content) => {
    await w.fileSystem.createTicketWorkspace({ ticketId: "SCRUM-2", repositoryName: "api" });
    // `.devflow` se crea al guardar: se asegura la carpeta con un guardado válido y se corrompe después.
    await w.fileSystem.saveFase1("SCRUM-2", fase1());
    writeFileSync(w.fase1Path, content);
    w.transformer.processContext.mockResolvedValue(ok(fase1({ resumen: "Regenerada" })));

    const summary = await w.start(w.repoA);

    expect(summary.blocked).toBeUndefined();
    expect(summary.ollamaStatus).toBe("ok");
    expect(w.transformer.processContext).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(w.fase1Path, "utf8"))).toMatchObject({ resumen: "Regenerada", generatedByOllama: true });
  });

  it("el reintento automático no necesita el flag: con una Fase 1 válida previa no reintenta", async () => {
    w.transformer.processContext.mockResolvedValue(ok(fase1({ resumen: "Buena desde el principio" })));
    await w.start(w.repoA);
    w.transformer.processContext.mockClear();

    const summary = await w.start(w.repoA);

    expect(w.transformer.processContext).not.toHaveBeenCalled();
    expect(summary.ollamaStatus).toBe("reused");
  });
});
