import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SQLiteStorageManager } from "../../../../src/database/sqlite-storage-manager.js";
import type { GitManager } from "../../../../src/services/git/git-manager.js";
import type { StartTicketContext } from "../../../../src/services/orchestrator/start-ticket.js";
import { TicketOrchestrator, type JiraGateway } from "../../../../src/services/orchestrator/ticket-orchestrator.js";
import type { StepResult } from "../../../../src/shared/errors/result.types.js";
import type { DocumentoFase1 } from "../../../../src/shared/types/documento-fase1.types.js";
import type { AskCallback, StartTicketInput, TicketRunSummary } from "../../../../src/shared/types/ticket-run.types.js";
import type { ContextoTicket } from "../../../../src/shared/types/ticket-context.types.js";

const NOW = new Date(2026, 10, 6, 15, 30, 0); // 06/11/2026, hora local

const BUG: ContextoTicket = {
  ticketId: "SCRUM-2",
  title: "El botón Aceptar desaparece",
  description: "Al borrar el importe desaparece el botón Aceptar",
  issueType: "Error",
  source: "jira",
};
const HISTORIA: ContextoTicket = { ...BUG, ticketId: "SCRUM-3", title: "Mostrar la bonificación", issueType: "Historia" };

const ESCENARIO = { titulo: "Botón visible", given: "un importe", when: "se borra", then: "el botón sigue visible" };
const FASE1: DocumentoFase1 = {
  presenteEnTicket: { pasosParaReproducir: true },
  resumen: "El botón desaparece al borrar el importe.",
  pasosParaReproducir: ["Borrar el importe."],
  comportamientoEsperado: "El botón sigue visible.",
  comportamientoActual: "El botón desaparece.",
  entorno: "No especificado en el ticket.",
  escenarios: [ESCENARIO],
  preguntasAbiertas: [],
  generatedByOllama: true,
  promptVersion: "bug-v1",
};

const ok = <T>(value: T): StepResult<T> => ({ kind: "Ok", value });

interface Options {
  withConfig?: boolean;
  /** Sustituye al gestor de archivos real (para simular fallos de carpeta o documento). */
  fileSystem?: StartTicketContext["fileSystem"];
}

function setup(options: Options = {}) {
  const root = mkdtempSync(join(tmpdir(), "devflow-start-"));
  const storage = new SQLiteStorageManager(":memory:");
  storage.migrate();
  if (options.withConfig !== false) {
    storage.upsertAppConfig({
      jiraBaseUrl: "https://equipo.atlassian.net",
      jiraEmail: "dev@example.com",
      jiraApiToken: "token",
      branchUserSuffix: "AROCHA",
      ticketsRootPath: root,
    });
  }
  const scrum = storage.upsertJiraProject({ jiraProjectKey: "SCRUM", jiraProjectName: "Mi Team" });
  const otro = storage.upsertJiraProject({ jiraProjectKey: "OTRO", jiraProjectName: "Sin repos" });
  const repo = storage.upsertRepository({ jiraProjectId: scrum.id, name: "api", repoLocalPath: "/work/api", defaultBaseBranch: "main" });
  const foreign = storage.upsertRepository({ jiraProjectId: otro.id, name: "ajeno", repoLocalPath: "/work/ajeno", defaultBaseBranch: "main" });
  // «OTRO» con repositorio propio solo si se pide; por defecto la clave OTRO queda sin repositorios (se borra el ajeno).
  storage.removeRepository(foreign.id);

  const calls: string[] = [];
  const steps: Array<[string, string, string | undefined]> = [];
  const jira = {
    fetchTicket: vi.fn(async (): Promise<StepResult<ContextoTicket>> => {
      calls.push("fetchTicket");
      return ok(BUG);
    }),
    getMyDisplayName: vi.fn(async (): Promise<StepResult<string>> => {
      calls.push("getMyDisplayName");
      return ok("Andrea Rocha");
    }),
    validateProjectKey: vi.fn(),
    listAssignedTickets: vi.fn(),
  };
  const git = {
    inspectRepository: vi.fn(async (): Promise<StepResult<{ branchAlreadyExists: boolean }>> => {
      calls.push("inspectRepository");
      return ok({ branchAlreadyExists: false });
    }),
    createBranch: vi.fn(async (input: { branchName: string; baseBranch: string }) => {
      calls.push("createBranch");
      return ok({ branchName: input.branchName, baseBranch: input.baseBranch, alreadyExisted: false });
    }),
    validateRepository: vi.fn(),
  };
  const transformer = {
    processContext: vi.fn(async (): Promise<StepResult<DocumentoFase1>> => {
      calls.push("processContext");
      return ok(FASE1);
    }),
  };
  const ask = vi.fn(async (request: { kind: string }): Promise<boolean | { title: string; description: string }> => {
    calls.push(`ask:${request.kind}`);
    return request.kind === "confirmActions" ? true : { title: "Título manual", description: "Descripción manual" };
  });
  const orchestrator = new TicketOrchestrator(storage, git as unknown as GitManager, () => jira as unknown as JiraGateway, {
    createTransformer: () => transformer,
    now: () => NOW,
    ...(options.fileSystem ? { createFileSystem: () => options.fileSystem! } : {}),
  });
  const start = (input: StartTicketInput) =>
    orchestrator.startTicket(input, { onStep: (step, status, detail) => steps.push([step, status, detail]), ask: ask as unknown as AskCallback });
  const rows = () => storage.db.prepare("SELECT * FROM ticket_logs ORDER BY id").all() as Array<Record<string, unknown>>;
  return { root, storage, scrum, otro, repo, calls, steps, jira, git, transformer, ask, orchestrator, start, rows };
}

type Fixture = ReturnType<typeof setup>;
let f: Fixture;
beforeEach(() => {
  f = setup();
});
afterEach(() => {
  f.storage.close();
  rmSync(f.root, { recursive: true, force: true });
});

describe("E1 — flujo principal", () => {
  describe("camino feliz con un bug", () => {
    it("ejecuta los pasos en orden y pide una sola confirmación después de inspeccionar y antes de escribir", async () => {
      await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id });

      expect(f.calls).toEqual([
        "fetchTicket",
        "getMyDisplayName",
        "inspectRepository",
        "ask:confirmActions",
        "createBranch",
        "processContext",
      ]);
    });

    it("la confirmación lleva el resumen de lo que se va a hacer", async () => {
      await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id, reprocessFase1: true });

      expect(f.ask).toHaveBeenCalledWith({
        kind: "confirmActions",
        summary: {
          ticketId: "SCRUM-2",
          issueType: "Error",
          repositoryName: "api",
          branchName: "bugs/SCRUM-2-AROCHA",
          baseBranch: "main",
          folderPath: join(f.root, "SCRUM-2", "api"),
          branchAlreadyExists: false,
          reprocessFase1: true,
        },
      });
    });

    it("crea la rama <prefijo>/<ID>-<SUFIJO> desde la base del repositorio y devuelve un resumen coherente", async () => {
      const summary = await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id });

      expect(f.git.createBranch).toHaveBeenCalledWith({ repoLocalPath: "/work/api", branchName: "bugs/SCRUM-2-AROCHA", baseBranch: "main" });
      expect(summary).toEqual<TicketRunSummary>({
        ticketId: "SCRUM-2",
        repositoryId: f.repo.id,
        issueType: "Error",
        branchName: "bugs/SCRUM-2-AROCHA",
        branchStatus: "created",
        folderPath: join(f.root, "SCRUM-2", "api"),
        documentPath: join(f.root, "SCRUM-2", "api", "SCRUM-2.md"),
        jiraFetchStatus: "ok",
        ollamaStatus: "ok",
        promptVersion: "bug-v1",
      });
    });

    it("crea la carpeta con adjuntos, escribe el documento de bug con el encabezado y guarda fase1.json", async () => {
      const summary = await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id });

      expect(existsSync(join(f.root, "SCRUM-2", "api", "adjuntos"))).toBe(true);
      expect(existsSync(join(f.root, "SCRUM-2", ".devflow", "fase1.json"))).toBe(true);
      const document = readFileSync(summary.documentPath!, "utf8");
      for (const expected of [
        "SCRUM-2",
        "El botón Aceptar desaparece",
        "06/11/2026",
        "Andrea Rocha",
        "https://equipo.atlassian.net/browse/SCRUM-2",
        "bugs/SCRUM-2-AROCHA",
        "SCRUM",
        "api",
        "El botón desaparece al borrar el importe.",
      ]) {
        expect(document).toContain(expected);
      }
    });

    it("deja una única fila en ticket_logs con todo lo ocurrido", async () => {
      await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id });

      const rows = f.rows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        ticket_id: "SCRUM-2",
        jira_project_id: f.scrum.id,
        repository_id: f.repo.id,
        issue_type: "Error",
        branch_type: "bugfix",
        branch_name: "bugs/SCRUM-2-AROCHA",
        base_branch: "main",
        branch_status: "created",
        jira_fetch_status: "ok",
        jira_fetch_error: null,
        ollama_status: "ok",
        prompt_version: "bug-v1",
        folder_path: join(f.root, "SCRUM-2", "api"),
        document_path: join(f.root, "SCRUM-2", "api", "SCRUM-2.md"),
      });
      expect(rows[0]?.started_at).toBeTruthy();
      expect(rows[0]?.finished_at).toBeTruthy();
    });

    it("emite onStep por cada paso: started y luego ok", async () => {
      await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id });

      expect(f.steps.map(([step, status]) => `${step}:${status}`)).toEqual([
        "jira:started",
        "jira:ok",
        "git:started",
        "git:ok",
        "filesystem:started",
        "filesystem:ok",
        "ollama:started",
        "ollama:ok",
      ]);
    });

    it("pasa a Ollama el ticket y el tipo de plantilla", async () => {
      await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id });

      expect(f.transformer.processContext).toHaveBeenCalledWith(BUG, "bug");
    });
  });

  describe("tipo de issue y rama", () => {
    it("una historia usa features/ y su plantilla", async () => {
      f.jira.fetchTicket.mockResolvedValue(ok(HISTORIA));
      f.transformer.processContext.mockResolvedValue(ok({ ...FASE1, promptVersion: "historia-v1" }));

      const summary = await f.start({ ticketId: "SCRUM-3", repositoryId: f.repo.id });

      expect(summary.branchName).toBe("features/SCRUM-3-AROCHA");
      expect(f.transformer.processContext).toHaveBeenCalledWith(HISTORIA, "historia");
      expect(f.rows()[0]).toMatchObject({ branch_type: "feature", prompt_version: "historia-v1" });
    });

    it("baseBranchOverride crea la rama desde otra base solo en esta ejecución", async () => {
      await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id, baseBranchOverride: "develop" });

      expect(f.git.createBranch).toHaveBeenCalledWith(expect.objectContaining({ baseBranch: "develop" }));
      expect(f.rows()[0]).toMatchObject({ base_branch: "develop" });
      expect(f.storage.listRepositories(f.scrum.id)[0]?.defaultBaseBranch).toBe("main");
    });
  });

  describe("Jira en fallback", () => {
    it.each(["network_timeout", "invalid_token", "not_found"] as const)(
      "%s: pide el ticket a mano con el motivo y continúa con source manual",
      async (reason) => {
        f.jira.fetchTicket.mockResolvedValue({ kind: "FallbackManual", reason });

        const summary = await f.start({ ticketId: "SCRUM-5", repositoryId: f.repo.id });

        expect(f.ask).toHaveBeenCalledWith({ kind: "manualTicket", ticketId: "SCRUM-5", reason });
        expect(f.transformer.processContext).toHaveBeenCalledWith(
          { ticketId: "SCRUM-5", title: "Título manual", description: "Descripción manual", issueType: "", source: "manual" },
          "historia",
        );
        expect(summary).toMatchObject({ jiraFetchStatus: "fallback_manual", branchName: "features/SCRUM-5-AROCHA", ollamaStatus: "ok" });
        expect(f.rows()[0]).toMatchObject({ jira_fetch_status: "fallback_manual", jira_fetch_error: reason });
        expect(f.steps).toContainEqual(["jira", "fallback", reason]);
      },
    );

    it("con el ticket manual no consulta el nombre de la desarrolladora: el encabezado la deja en blanco", async () => {
      f.jira.fetchTicket.mockResolvedValue({ kind: "FallbackManual", reason: "network_timeout" });

      await f.start({ ticketId: "SCRUM-5", repositoryId: f.repo.id });

      expect(f.jira.getMyDisplayName).not.toHaveBeenCalled();
    });

    it("un error bloqueante de Jira corta el flujo sin pedir nada, sin crear nada y sin fila", async () => {
      f.jira.fetchTicket.mockResolvedValue({ kind: "ErrorBloqueante", subtype: "ErrorInesperado", message: "Jira respondió algo raro" });

      const summary = await f.start({ ticketId: "SCRUM-5", repositoryId: f.repo.id });

      expect(summary.blocked).toMatchObject({ subtype: "ErrorInesperado", message: "Jira respondió algo raro" });
      expect(f.ask).not.toHaveBeenCalled();
      expect(f.git.createBranch).not.toHaveBeenCalled();
      expect(f.rows()).toEqual([]);
      expect(f.steps).toContainEqual(["jira", "error", "Jira respondió algo raro"]);
    });
  });

  describe("Ollama en fallback", () => {
    it("completa igual: documento sin redactar, sin fase1.json y ollama_status fallback_deterministic", async () => {
      f.transformer.processContext.mockResolvedValue({ kind: "FallbackDeterminista", rawText: "texto crudo del ticket" });

      const summary = await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id });

      expect(summary).toMatchObject({ branchStatus: "created", ollamaStatus: "fallback_deterministic", promptVersion: "bug-v1" });
      const document = readFileSync(summary.documentPath!, "utf8");
      expect(document).toContain("⚠️ Generado sin Ollama");
      expect(document).toContain("texto crudo del ticket");
      expect(existsSync(join(f.root, "SCRUM-2", ".devflow", "fase1.json"))).toBe(false);
      expect(f.rows()[0]).toMatchObject({ ollama_status: "fallback_deterministic", prompt_version: "bug-v1" });
      expect(f.steps).toContainEqual(["ollama", "fallback", undefined]);
    });
  });

  describe("entrada que corta el flujo antes de tocar nada", () => {
    it("una épica devuelve blocked sin pedir confirmación, sin rama, carpeta, documento ni fila", async () => {
      f.jira.fetchTicket.mockResolvedValue(ok({ ...BUG, ticketId: "SCRUM-9", issueType: "Epic" }));

      const summary = await f.start({ ticketId: "SCRUM-9", repositoryId: f.repo.id });

      expect(summary.blocked).toMatchObject({ subtype: "TipoIssueBloqueado" });
      expect(summary).toMatchObject({ branchName: null, folderPath: null, documentPath: null, ollamaStatus: null });
      expect(f.jira.fetchTicket).toHaveBeenCalledTimes(1);
      expect(f.jira.getMyDisplayName).not.toHaveBeenCalled();
      expect(f.git.inspectRepository).not.toHaveBeenCalled();
      expect(f.ask).not.toHaveBeenCalled();
      expect(existsSync(join(f.root, "SCRUM-9"))).toBe(false);
      expect(f.rows()).toEqual([]);
    });

    it("una clave que no está configurada devuelve blocked con las claves disponibles, sin llamar a Jira", async () => {
      const summary = await f.start({ ticketId: "ZZZ-1" });

      expect(summary.blocked?.message).toContain("ZZZ");
      expect(summary.blocked?.message).toContain("SCRUM");
      expect(f.jira.fetchTicket).not.toHaveBeenCalled();
      expect(f.rows()).toEqual([]);
    });

    it("un ID mal formado devuelve blocked sin llamar a Jira", async () => {
      const summary = await f.start({ ticketId: "scrum12" });

      expect(summary.blocked).toBeDefined();
      expect(f.jira.fetchTicket).not.toHaveBeenCalled();
    });

    it("sin configuración de la herramienta devuelve blocked que indica ejecutar devflow config", async () => {
      const bare = setup({ withConfig: false });

      const summary = await bare.start({ ticketId: "SCRUM-2" });

      expect(summary.blocked?.message).toContain("devflow config");
      expect(bare.jira.fetchTicket).not.toHaveBeenCalled();
      bare.storage.close();
      rmSync(bare.root, { recursive: true, force: true });
    });

    it("un repositoryId que no existe devuelve blocked sin llamar a Jira ni escribir nada", async () => {
      const summary = await f.start({ ticketId: "SCRUM-2", repositoryId: 9999 });

      expect(summary.blocked).toMatchObject({ subtype: "RepositorioNoEncontrado" });
      expect(f.jira.fetchTicket).not.toHaveBeenCalled();
      expect(f.rows()).toEqual([]);
    });

    it("un repositoryId de otra clave devuelve blocked", async () => {
      const foreign = f.storage.upsertRepository({ jiraProjectId: f.otro.id, name: "ajeno", repoLocalPath: "/work/ajeno" });

      const summary = await f.start({ ticketId: "SCRUM-2", repositoryId: foreign.id });

      expect(summary.blocked).toMatchObject({ subtype: "RepositorioNoEncontrado" });
      expect(f.git.inspectRepository).not.toHaveBeenCalled();
    });

    it("con repositorios configurados pero sin repositoryId devuelve blocked que pide elegir uno", async () => {
      const summary = await f.start({ ticketId: "SCRUM-2" });

      expect(summary.blocked?.message).toContain("repositorio");
      expect(f.jira.fetchTicket).not.toHaveBeenCalled();
      expect(f.rows()).toEqual([]);
    });
  });

  describe("clave sin repositorios: solo el documento", () => {
    it("no ejecuta pasos de Git, genera el documento y registra la fila sin repositorio", async () => {
      f.jira.fetchTicket.mockResolvedValue(ok({ ...HISTORIA, ticketId: "OTRO-5" }));

      const summary = await f.start({ ticketId: "OTRO-5" });

      expect(f.git.inspectRepository).not.toHaveBeenCalled();
      expect(f.git.createBranch).not.toHaveBeenCalled();
      expect(f.steps.some(([step]) => step === "git")).toBe(false);
      expect(summary).toMatchObject({
        repositoryId: null,
        branchName: null,
        branchStatus: null,
        folderPath: join(f.root, "OTRO-5"),
        documentPath: join(f.root, "OTRO-5", "OTRO-5.md"),
        ollamaStatus: "ok",
      });
      expect(existsSync(join(f.root, "OTRO-5", "OTRO-5.md"))).toBe(true);
      expect(f.ask).toHaveBeenCalledWith({
        kind: "confirmActions",
        summary: expect.objectContaining({ repositoryName: null, branchName: null, baseBranch: null, folderPath: join(f.root, "OTRO-5") }),
      });
      expect(f.rows()[0]).toMatchObject({ repository_id: null, branch_name: null, branch_status: null });
    });

    it("al repetir la ejecución actualiza la misma fila: no se duplica", async () => {
      f.jira.fetchTicket.mockResolvedValue(ok({ ...HISTORIA, ticketId: "OTRO-5" }));

      await f.start({ ticketId: "OTRO-5" });
      await f.start({ ticketId: "OTRO-5" });

      expect(f.rows()).toHaveLength(1);
    });
  });
});

describe("E2 — cortes en Git y confirmación única", () => {
  const blockedGit = (subtype: "CambiosPendientes" | "RamaExistenteEnRemoto" | "RepositorioNoEncontrado" | "ErrorInesperado", message: string) =>
    ({ kind: "ErrorBloqueante", subtype, message }) as const;

  /** Nada se escribió: ni rama, ni carpeta, ni documento, ni Ollama. */
  const expectNothingWritten = () => {
    expect(f.git.createBranch).not.toHaveBeenCalled();
    expect(f.transformer.processContext).not.toHaveBeenCalled();
    expect(existsSync(join(f.root, "SCRUM-2"))).toBe(false);
  };

  describe("cortes tras inspeccionar el repositorio (antes de pedir confirmar)", () => {
    it("cambios pendientes: blocked sin pedir confirmación, con la lista de archivos, y fila pending_changes", async () => {
      f.git.inspectRepository.mockResolvedValue(blockedGit("CambiosPendientes", "Hay cambios sin commitear:\n M src/a.ts\n?? notas.txt"));

      const summary = await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id });

      expect(summary.blocked).toMatchObject({ subtype: "CambiosPendientes" });
      expect(summary.blocked?.message).toContain("src/a.ts");
      expect(summary.blocked?.message).toContain("notas.txt");
      expect(summary).toMatchObject({
        branchName: "bugs/SCRUM-2-AROCHA",
        branchStatus: "pending_changes",
        folderPath: null,
        documentPath: null,
        ollamaStatus: null,
      });
      expect(f.ask).not.toHaveBeenCalled();
      expectNothingWritten();
      expect(f.rows()).toHaveLength(1);
      expect(f.rows()[0]).toMatchObject({
        branch_status: "pending_changes",
        branch_name: "bugs/SCRUM-2-AROCHA",
        base_branch: "main",
        ollama_status: null,
        folder_path: null,
        document_path: null,
      });
      expect(f.steps).toContainEqual(["git", "error", expect.stringContaining("notas.txt")]);
    });

    it.each([
      ["rama solo en origin", blockedGit("RamaExistenteEnRemoto", "La rama ya existe en origin")],
      ["la ruta ya no es un repositorio Git", blockedGit("RepositorioNoEncontrado", "No se encontró un repositorio Git en /work/api")],
      ["nombre de rama no válido", blockedGit("ErrorInesperado", "Nombre de rama no válido")],
    ])("%s: blocked sin pedir confirmación y fila branch_status error", async (_name, failure) => {
      f.git.inspectRepository.mockResolvedValue(failure);

      const summary = await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id });

      expect(summary.blocked).toMatchObject({ subtype: failure.subtype, message: failure.message });
      expect(summary).toMatchObject({ branchStatus: "error", folderPath: null, documentPath: null, ollamaStatus: null });
      expect(f.ask).not.toHaveBeenCalled();
      expectNothingWritten();
      expect(f.rows()).toHaveLength(1);
      expect(f.rows()[0]).toMatchObject({ branch_status: "error", ollama_status: null, folder_path: null, document_path: null });
    });
  });

  describe("confirmación única", () => {
    it("se pide una sola vez por ejecución, tras inspeccionar y antes de crear la rama", async () => {
      await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id });

      expect(f.calls.filter((call) => call.startsWith("ask:"))).toEqual(["ask:confirmActions"]);
      expect(f.calls.indexOf("ask:confirmActions")).toBeGreaterThan(f.calls.indexOf("inspectRepository"));
      expect(f.calls.indexOf("ask:confirmActions")).toBeLessThan(f.calls.indexOf("createBranch"));
    });

    it("si la persona no confirma: cancelled, sin rama, carpeta, documento ni Ollama, y sin fila", async () => {
      f.ask.mockImplementation(async (request: { kind: string }) => {
        f.calls.push(`ask:${request.kind}`);
        return false;
      });

      const summary = await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id });

      expect(summary).toMatchObject({ cancelled: true, branchName: null, folderPath: null, documentPath: null, ollamaStatus: null });
      expect(summary.blocked).toBeUndefined();
      expect(f.ask).toHaveBeenCalledTimes(1);
      expect(f.git.inspectRepository).toHaveBeenCalledTimes(1);
      expectNothingWritten();
      expect(f.rows()).toEqual([]);
    });

    it("cancelar una clave sin repositorios tampoco crea carpeta ni documento", async () => {
      f.jira.fetchTicket.mockResolvedValue(ok({ ...HISTORIA, ticketId: "OTRO-5" }));
      f.ask.mockResolvedValue(false);

      const summary = await f.start({ ticketId: "OTRO-5" });

      expect(summary.cancelled).toBe(true);
      expect(existsSync(join(f.root, "OTRO-5"))).toBe(false);
      expect(f.transformer.processContext).not.toHaveBeenCalled();
      expect(f.rows()).toEqual([]);
    });
  });

  describe("rama que ya existe en local", () => {
    beforeEach(() => {
      f.git.inspectRepository.mockResolvedValue(ok({ branchAlreadyExists: true }));
      f.git.createBranch.mockImplementation(async (input: { branchName: string; baseBranch: string }) =>
        ok({ branchName: input.branchName, baseBranch: input.baseBranch, alreadyExisted: true }),
      );
    });

    it("la confirmación avisa que existe; si se acepta continúa con carpeta y documento sin duplicar la rama", async () => {
      const summary = await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id });

      expect(f.ask).toHaveBeenCalledWith({ kind: "confirmActions", summary: expect.objectContaining({ branchAlreadyExists: true }) });
      expect(summary).toMatchObject({ branchStatus: "already_existed", ollamaStatus: "ok" });
      expect(existsSync(summary.documentPath!)).toBe(true);
      expect(f.rows()[0]).toMatchObject({ branch_status: "already_existed" });
    });

    it("si se rechaza, la ejecución se cancela sin crear nada", async () => {
      f.ask.mockResolvedValue(false);

      const summary = await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id });

      expect(summary.cancelled).toBe(true);
      expectNothingWritten();
      expect(f.rows()).toEqual([]);
    });
  });

  describe("cortes después de confirmar", () => {
    it("pull de la base fallido: blocked, sin carpeta ni documento, y fila branch_status error", async () => {
      f.git.createBranch.mockResolvedValue({
        kind: "ErrorBloqueante",
        subtype: "PullFallido",
        message: "No se pudo actualizar la base «main»; el repositorio quedó en main.",
      });

      const summary = await f.start({ ticketId: "SCRUM-2", repositoryId: f.repo.id });

      expect(summary.blocked).toMatchObject({ subtype: "PullFallido" });
      expect(summary.blocked?.message).toContain("quedó en main");
      expect(summary).toMatchObject({ branchStatus: "error", folderPath: null, documentPath: null, ollamaStatus: null });
      expect(f.ask).toHaveBeenCalledTimes(1);
      expect(f.transformer.processContext).not.toHaveBeenCalled();
      expect(existsSync(join(f.root, "SCRUM-2"))).toBe(false);
      expect(f.rows()[0]).toMatchObject({ branch_status: "error", ollama_status: null, folder_path: null, document_path: null });
      expect(f.steps).toContainEqual(["git", "error", expect.stringContaining("quedó en main")]);
    });

    it("la carpeta no se puede crear tras crear la rama: blocked, sin Ollama, y fila con la rama pero sin rutas", async () => {
      const failing = setup({
        fileSystem: {
          createTicketWorkspace: async () => ({ kind: "ErrorBloqueante", subtype: "PermisosInsuficientes", message: "No hay permisos para crear D:\\JIRAS" }),
          saveFase1: async () => ok(undefined),
          writeDocument: async () => ok({ documentPath: "x" }),
        },
      });

      const summary = await failing.start({ ticketId: "SCRUM-2", repositoryId: failing.repo.id });

      expect(summary.blocked).toMatchObject({ subtype: "PermisosInsuficientes" });
      expect(failing.git.createBranch).toHaveBeenCalledTimes(1);
      expect(failing.transformer.processContext).not.toHaveBeenCalled();
      expect(failing.rows()[0]).toMatchObject({
        branch_status: "created",
        branch_name: "bugs/SCRUM-2-AROCHA",
        ollama_status: null,
        folder_path: null,
        document_path: null,
      });
      expect(failing.steps).toContainEqual(["filesystem", "error", expect.stringContaining("permisos")]);
      failing.storage.close();
      rmSync(failing.root, { recursive: true, force: true });
    });

    it("el documento no se puede escribir: blocked y fila con la rama y Ollama, pero sin rutas", async () => {
      const failing = setup({
        fileSystem: {
          createTicketWorkspace: async () => ok({ folderPath: "carpeta", documentPath: "carpeta/doc.md" }),
          saveFase1: async () => ok(undefined),
          writeDocument: async () => ({ kind: "ErrorBloqueante", subtype: "PermisosInsuficientes", message: "No hay permisos para escribir el documento" }),
        },
      });

      const summary = await failing.start({ ticketId: "SCRUM-2", repositoryId: failing.repo.id });

      expect(summary.blocked).toMatchObject({ subtype: "PermisosInsuficientes" });
      expect(failing.rows()[0]).toMatchObject({ branch_status: "created", ollama_status: "ok", folder_path: null, document_path: null });
      failing.storage.close();
      rmSync(failing.root, { recursive: true, force: true });
    });
  });
});
