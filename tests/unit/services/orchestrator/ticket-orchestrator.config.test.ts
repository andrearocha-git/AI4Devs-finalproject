import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SQLiteStorageManager } from "../../../../src/database/sqlite-storage-manager.js";
import type { StepResult } from "../../../../src/shared/errors/result.types.js";
import type { AppConfig } from "../../../../src/shared/types/config.types.js";
import {
  TicketOrchestrator,
  type JiraGateway,
} from "../../../../src/services/orchestrator/ticket-orchestrator.js";
import type { GitManager } from "../../../../src/services/git/git-manager.js";

const JIRA_CONFIG: Partial<AppConfig> = {
  jiraBaseUrl: "https://example.atlassian.net",
  jiraEmail: "dev@example.com",
  jiraApiToken: "token",
  branchUserSuffix: "AROCHA",
  ticketsRootPath: "/tickets",
};

interface Fixture {
  storage: SQLiteStorageManager;
  jira: { [K in keyof JiraGateway]: ReturnType<typeof vi.fn> };
  git: { validateRepository: ReturnType<typeof vi.fn> };
  createJiraClient: ReturnType<typeof vi.fn>;
  orchestrator: TicketOrchestrator;
}

function setup(config: Partial<AppConfig> | null = JIRA_CONFIG): Fixture {
  const storage = new SQLiteStorageManager(":memory:");
  storage.migrate();
  if (config) storage.upsertAppConfig(config);
  const jira = {
    validateProjectKey: vi.fn(),
    listAssignedTickets: vi.fn(),
    getMyDisplayName: vi.fn(),
  };
  const git = { validateRepository: vi.fn() };
  const createJiraClient = vi.fn(() => jira);
  const orchestrator = new TicketOrchestrator(storage, git as unknown as GitManager, createJiraClient);
  return { storage, jira, git, createJiraClient, orchestrator };
}

/** Registra una ejecución en `ticket_logs` para que el proyecto (y su repositorio) tengan historial. */
function addHistory(storage: SQLiteStorageManager, jiraProjectId: number, repositoryId: number | null): void {
  storage.upsertTicketLog({
    ticketId: "SCRUM-1",
    jiraProjectId,
    repositoryId,
    issueType: "Story",
    branchType: "feature",
    branchName: null,
    baseBranch: null,
    branchStatus: null,
    jiraFetchStatus: "ok",
    ollamaStatus: null,
    folderPath: null,
    documentPath: null,
    startedAt: "2026-11-05T10:00:00Z",
  });
}

let fixture: Fixture;
beforeEach(() => {
  fixture = setup();
});
afterEach(() => fixture.storage.close());

describe("E1 — proyectos", () => {
  it("addProject con Ok persiste la clave en mayúsculas con el nombre de Jira", async () => {
    fixture.jira.validateProjectKey.mockResolvedValue({ kind: "Ok", value: { key: "SCRUM", name: "Scrum Board" } });

    const result = await fixture.orchestrator.addProject("scrum");

    expect(fixture.jira.validateProjectKey).toHaveBeenCalledWith("SCRUM");
    expect(result.kind).toBe("Ok");
    if (result.kind !== "Ok") return;
    expect(result.value).toMatchObject({ jiraProjectKey: "SCRUM", jiraProjectName: "Scrum Board" });
    expect(fixture.storage.getJiraProject("SCRUM")).not.toBeNull();
  });

  it.each<[string, StepResult<{ key: string; name: string }>]>([
    ["clave inexistente", { kind: "FallbackManual", reason: "not_found" }],
    ["token inválido", { kind: "FallbackManual", reason: "invalid_token" }],
    ["Jira caído", { kind: "FallbackManual", reason: "network_timeout" }],
    ["error bloqueante", { kind: "ErrorBloqueante", subtype: "ErrorInesperado", message: "boom" }],
  ])("addProject con %s devuelve el resultado tal cual y no escribe nada", async (_name, jiraResult) => {
    fixture.jira.validateProjectKey.mockResolvedValue(jiraResult);

    const result = await fixture.orchestrator.addProject("SCRUM");

    expect(result).toEqual(jiraResult);
    expect(fixture.storage.listJiraProjects()).toEqual([]);
  });

  it("addProject sin configuración de Jira devuelve ErrorBloqueante que indica ejecutar devflow config", async () => {
    const empty = setup(null);

    const result = await empty.orchestrator.addProject("SCRUM");

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(result.kind === "ErrorBloqueante" && result.message).toContain("devflow config");
    expect(empty.createJiraClient).not.toHaveBeenCalled();
    empty.storage.close();
  });

  it("listProjects devuelve los proyectos guardados", () => {
    fixture.storage.upsertJiraProject({ jiraProjectKey: "SCRUM", jiraProjectName: "Scrum" });

    expect(fixture.orchestrator.listProjects().map((p) => p.jiraProjectKey)).toEqual(["SCRUM"]);
  });

  it("removeProject borra el proyecto sin historial", () => {
    fixture.storage.upsertJiraProject({ jiraProjectKey: "SCRUM", jiraProjectName: "Scrum" });

    fixture.orchestrator.removeProject("SCRUM");

    expect(fixture.storage.getJiraProject("SCRUM")).toBeNull();
  });

  it.each(["scrum", " SCRUM ", "Scrum"])("removeProject normaliza la clave «%s» como addProject", (key) => {
    fixture.storage.upsertJiraProject({ jiraProjectKey: "SCRUM", jiraProjectName: "Scrum" });

    fixture.orchestrator.removeProject(key);

    expect(fixture.storage.getJiraProject("SCRUM")).toBeNull();
  });

  it("removeProject con historial nombra la clave normalizada en el mensaje", () => {
    const project = fixture.storage.upsertJiraProject({ jiraProjectKey: "SCRUM", jiraProjectName: "Scrum" });
    addHistory(fixture.storage, project.id, null);

    expect(() => fixture.orchestrator.removeProject("scrum")).toThrow(/proyecto SCRUM:/);
  });

  it("removeProject con historial lanza un mensaje claro (sin el texto crudo de SQLite) y deja el proyecto intacto", () => {
    const project = fixture.storage.upsertJiraProject({ jiraProjectKey: "SCRUM", jiraProjectName: "Scrum" });
    addHistory(fixture.storage, project.id, null);

    let error: unknown;
    try {
      fixture.orchestrator.removeProject("SCRUM");
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("SCRUM");
    expect(message).toContain("tickets registrados");
    expect(message).not.toContain("FOREIGN KEY");
    expect(fixture.storage.getJiraProject("SCRUM")).not.toBeNull();
  });

  it("removeProject relanza un error que no sea de clave foránea", () => {
    const boom = new Error("disco lleno");
    vi.spyOn(fixture.storage, "removeJiraProject").mockImplementation(() => {
      throw boom;
    });

    expect(() => fixture.orchestrator.removeProject("SCRUM")).toThrow(boom);
  });
});

describe("E2 — repositorios", () => {
  const REPO = { jiraProjectKey: "SCRUM", name: "api", repoLocalPath: "/work/api" };
  let projectId: number;

  beforeEach(() => {
    projectId = fixture.storage.upsertJiraProject({ jiraProjectKey: "SCRUM", jiraProjectName: "Scrum" }).id;
    fixture.git.validateRepository.mockResolvedValue({ kind: "Ok", value: undefined });
  });

  it("addRepository con Ok valida con la rama base dada y persiste el repositorio", async () => {
    const result = await fixture.orchestrator.addRepository({ ...REPO, defaultBaseBranch: "develop" });

    expect(fixture.git.validateRepository).toHaveBeenCalledWith({ repoLocalPath: "/work/api", baseBranch: "develop" });
    expect(result.kind).toBe("Ok");
    if (result.kind !== "Ok") return;
    expect(result.value).toMatchObject({ jiraProjectId: projectId, name: "api", repoLocalPath: "/work/api", defaultBaseBranch: "develop" });
    expect(fixture.storage.listRepositories(projectId)).toHaveLength(1);
  });

  it("addRepository sin defaultBaseBranch valida y guarda main", async () => {
    const result = await fixture.orchestrator.addRepository(REPO);

    expect(fixture.git.validateRepository).toHaveBeenCalledWith({ repoLocalPath: "/work/api", baseBranch: "main" });
    expect(result.kind === "Ok" && result.value.defaultBaseBranch).toBe("main");
  });

  it("addRepository sobre un repositorio existente sin defaultBaseBranch conserva (y valida) la rama guardada", async () => {
    await fixture.orchestrator.addRepository({ ...REPO, defaultBaseBranch: "develop" });

    const result = await fixture.orchestrator.addRepository({ ...REPO, repoLocalPath: "/work/api2" });

    expect(fixture.git.validateRepository).toHaveBeenLastCalledWith({ repoLocalPath: "/work/api2", baseBranch: "develop" });
    expect(result.kind === "Ok" && result.value).toMatchObject({ repoLocalPath: "/work/api2", defaultBaseBranch: "develop" });
    expect(fixture.storage.listRepositories(projectId)).toHaveLength(1);
  });

  it("addRepository recorta nombre, ruta y rama: «api » y «api» son el mismo repositorio", async () => {
    await fixture.orchestrator.addRepository({ ...REPO, defaultBaseBranch: "develop" });

    const result = await fixture.orchestrator.addRepository({ ...REPO, name: " api ", repoLocalPath: " /work/api2 " });

    expect(fixture.git.validateRepository).toHaveBeenLastCalledWith({ repoLocalPath: "/work/api2", baseBranch: "develop" });
    expect(result.kind === "Ok" && result.value).toMatchObject({ name: "api", repoLocalPath: "/work/api2", defaultBaseBranch: "develop" });
    expect(fixture.storage.listRepositories(projectId)).toHaveLength(1);
  });

  it("addRepository recorta la rama base antes de validarla con Git", async () => {
    await fixture.orchestrator.addRepository({ ...REPO, defaultBaseBranch: " develop " });

    expect(fixture.git.validateRepository).toHaveBeenCalledWith({ repoLocalPath: "/work/api", baseBranch: "develop" });
  });

  it("addRepository trata una rama base en blanco como omitida", async () => {
    const result = await fixture.orchestrator.addRepository({ ...REPO, defaultBaseBranch: "   " });

    expect(fixture.git.validateRepository).toHaveBeenCalledWith({ repoLocalPath: "/work/api", baseBranch: "main" });
    expect(result.kind === "Ok" && result.value.defaultBaseBranch).toBe("main");
  });

  it("updateRepository recorta el nombre y la rama base", async () => {
    await fixture.orchestrator.addRepository(REPO);

    const result = await fixture.orchestrator.updateRepository({ ...REPO, name: "api ", defaultBaseBranch: " release " });

    expect(fixture.git.validateRepository).toHaveBeenLastCalledWith({ repoLocalPath: "/work/api", baseBranch: "release" });
    expect(result.kind === "Ok" && result.value).toMatchObject({ name: "api", defaultBaseBranch: "release" });
  });

  it.each([
    ["nombre", { name: "  " }],
    ["ruta", { repoLocalPath: "  " }],
  ])("addRepository con %s en blanco devuelve ErrorBloqueante sin llamar a Git ni escribir nada", async (_campo, blank) => {
    const result = await fixture.orchestrator.addRepository({ ...REPO, ...blank });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(fixture.git.validateRepository).not.toHaveBeenCalled();
    expect(fixture.storage.listRepositories(projectId)).toEqual([]);
  });

  it("updateRepository con nombre en blanco devuelve ErrorBloqueante sin llamar a Git", async () => {
    await fixture.orchestrator.addRepository(REPO);
    fixture.git.validateRepository.mockClear();

    const result = await fixture.orchestrator.updateRepository({ ...REPO, name: " " });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(result.kind === "ErrorBloqueante" && result.message).toContain("nombre");
    expect(fixture.git.validateRepository).not.toHaveBeenCalled();
  });

  it("addRepository acepta la clave de proyecto en minúsculas", async () => {
    const result = await fixture.orchestrator.addRepository({ ...REPO, jiraProjectKey: "scrum" });

    expect(result.kind).toBe("Ok");
  });

  it("addRepository con la validación de Git rechazada devuelve el error tal cual y no escribe nada", async () => {
    const rejected = { kind: "ErrorBloqueante", subtype: "RepositorioNoEncontrado", message: "no es un repo" };
    fixture.git.validateRepository.mockResolvedValue(rejected);

    const result = await fixture.orchestrator.addRepository(REPO);

    expect(result).toEqual(rejected);
    expect(fixture.storage.listRepositories(projectId)).toEqual([]);
  });

  it("addRepository con la validación de Git en FallbackManual la devuelve tal cual y no escribe nada", async () => {
    const manual = { kind: "FallbackManual", reason: "network_timeout" };
    fixture.git.validateRepository.mockResolvedValue(manual);

    const result = await fixture.orchestrator.addRepository(REPO);

    expect(result).toEqual(manual);
    expect(fixture.storage.listRepositories(projectId)).toEqual([]);
  });

  it("addRepository con una clave no configurada devuelve las claves disponibles sin llamar a Git", async () => {
    const result = await fixture.orchestrator.addRepository({ ...REPO, jiraProjectKey: "OTRO" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(result.kind === "ErrorBloqueante" && result.message).toContain("OTRO");
    expect(result.kind === "ErrorBloqueante" && result.message).toContain("SCRUM");
    expect(fixture.git.validateRepository).not.toHaveBeenCalled();
  });

  it("updateRepository vuelve a validar, conserva el id y actualiza la ruta", async () => {
    const created = await fixture.orchestrator.addRepository({ ...REPO, defaultBaseBranch: "develop" });
    const id = created.kind === "Ok" ? created.value.id : -1;

    const result = await fixture.orchestrator.updateRepository({ ...REPO, repoLocalPath: "/work/api2" });

    expect(fixture.git.validateRepository).toHaveBeenLastCalledWith({ repoLocalPath: "/work/api2", baseBranch: "develop" });
    expect(result.kind === "Ok" && result.value).toMatchObject({ id, repoLocalPath: "/work/api2", defaultBaseBranch: "develop" });
  });

  it("updateRepository con otra rama base la valida y la guarda", async () => {
    await fixture.orchestrator.addRepository(REPO);

    const result = await fixture.orchestrator.updateRepository({ ...REPO, defaultBaseBranch: "release" });

    expect(fixture.git.validateRepository).toHaveBeenLastCalledWith({ repoLocalPath: "/work/api", baseBranch: "release" });
    expect(result.kind === "Ok" && result.value.defaultBaseBranch).toBe("release");
  });

  it("updateRepository con validación rechazada no cambia lo guardado", async () => {
    await fixture.orchestrator.addRepository(REPO);
    const rejected = { kind: "ErrorBloqueante", subtype: "RepositorioNoEncontrado", message: "no existe" };
    fixture.git.validateRepository.mockResolvedValue(rejected);

    const result = await fixture.orchestrator.updateRepository({ ...REPO, repoLocalPath: "/otra" });

    expect(result).toEqual(rejected);
    expect(fixture.storage.listRepositories(projectId)[0]?.repoLocalPath).toBe("/work/api");
  });

  it("updateRepository sobre un repositorio inexistente devuelve ErrorBloqueante sin llamar a Git", async () => {
    const result = await fixture.orchestrator.updateRepository(REPO);

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "RepositorioNoEncontrado" });
    expect(fixture.git.validateRepository).not.toHaveBeenCalled();
  });

  it("updateRepository con una clave no configurada devuelve las claves disponibles", async () => {
    const result = await fixture.orchestrator.updateRepository({ ...REPO, jiraProjectKey: "OTRO" });

    expect(result.kind === "ErrorBloqueante" && result.message).toContain("SCRUM");
  });

  it("removeRepository borra el repositorio sin historial", async () => {
    const created = await fixture.orchestrator.addRepository(REPO);
    if (created.kind !== "Ok") throw new Error("alta fallida");

    fixture.orchestrator.removeRepository(created.value.id);

    expect(fixture.storage.listRepositories(projectId)).toEqual([]);
  });

  it("removeRepository con historial lanza un mensaje claro (sin el texto crudo de SQLite) y lo deja intacto", async () => {
    const created = await fixture.orchestrator.addRepository(REPO);
    if (created.kind !== "Ok") throw new Error("alta fallida");
    addHistory(fixture.storage, projectId, created.value.id);

    let error: unknown;
    try {
      fixture.orchestrator.removeRepository(created.value.id);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("tickets registrados");
    expect((error as Error).message).not.toContain("FOREIGN KEY");
    expect(fixture.storage.listRepositories(projectId)).toHaveLength(1);
  });

  it("removeRepository relanza un error que no sea de clave foránea", () => {
    const boom = new Error("disco lleno");
    vi.spyOn(fixture.storage, "removeRepository").mockImplementation(() => {
      throw boom;
    });

    expect(() => fixture.orchestrator.removeRepository(1)).toThrow(boom);
  });

  it("listRepositoriesForTicket deriva la clave del ID y devuelve sus repositorios sin llamar a Jira", async () => {
    await fixture.orchestrator.addRepository(REPO);

    const result = fixture.orchestrator.listRepositoriesForTicket("SCRUM-12");

    expect(result.kind === "Ok" && result.value.map((r) => r.name)).toEqual(["api"]);
    expect(fixture.createJiraClient).not.toHaveBeenCalled();
  });

  it("listRepositoriesForTicket devuelve Ok vacío si el proyecto no tiene repositorios", () => {
    expect(fixture.orchestrator.listRepositoriesForTicket("SCRUM-12")).toEqual({ kind: "Ok", value: [] });
  });

  it("listRepositoriesForTicket con una clave no configurada devuelve las claves disponibles sin llamar a Jira", () => {
    const result = fixture.orchestrator.listRepositoriesForTicket("OTRO-1");

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(result.kind === "ErrorBloqueante" && result.message).toContain("OTRO");
    expect(result.kind === "ErrorBloqueante" && result.message).toContain("SCRUM");
    expect(fixture.createJiraClient).not.toHaveBeenCalled();
  });

  it("listRepositoriesForTicket con un ID mal formado devuelve ErrorBloqueante con las claves disponibles, sin llamar a Jira", () => {
    const result = fixture.orchestrator.listRepositoriesForTicket("scrum12");

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(result.kind === "ErrorBloqueante" && result.message).toContain("scrum12");
    expect(result.kind === "ErrorBloqueante" && result.message).toContain("SCRUM");
    expect(fixture.createJiraClient).not.toHaveBeenCalled();
  });

  it("listRepositoriesForTicket con un ID mal formado pide corregir el ID, no dar de alta una clave", () => {
    const result = fixture.orchestrator.listRepositoriesForTicket("scrum12");

    expect(result.kind === "ErrorBloqueante" && result.message).not.toContain("devflow config proyectos");
  });

  it("listRepositoriesForTicket con una clave no configurada sí sugiere darla de alta", () => {
    const result = fixture.orchestrator.listRepositoriesForTicket("OTRO-1");

    expect(result.kind === "ErrorBloqueante" && result.message).toContain("devflow config proyectos");
  });

  it("listRepositoriesForTicket acepta el ID en minúsculas", async () => {
    await fixture.orchestrator.addRepository(REPO);

    const result = fixture.orchestrator.listRepositoriesForTicket("scrum-12");

    expect(result.kind === "Ok" && result.value.map((r) => r.name)).toEqual(["api"]);
  });

  it("indica que no hay claves configuradas cuando la lista está vacía", async () => {
    const empty = setup();
    const result = empty.orchestrator.listRepositoriesForTicket("SCRUM-1");

    expect(result.kind === "ErrorBloqueante" && result.message).toContain("ninguna");
    empty.storage.close();
  });
});

describe("E3 — configuración, sufijo sugerido y tickets asignados", () => {
  describe("getConfig / saveConfig", () => {
    it("getConfig devuelve null sin configuración y luego lo guardado", () => {
      const empty = setup(null);
      expect(empty.orchestrator.getConfig()).toBeNull();

      empty.orchestrator.saveConfig(JIRA_CONFIG);

      expect(empty.orchestrator.getConfig()).toMatchObject({ jiraEmail: "dev@example.com", branchUserSuffix: "AROCHA" });
      empty.storage.close();
    });

    it("saveConfig parcial persiste los campos dados y conserva los demás", () => {
      fixture.orchestrator.saveConfig({ branchUserSuffix: "PGOMEZ" });
      fixture.orchestrator.saveConfig({ jiraEmail: "otro@example.com" });

      expect(fixture.orchestrator.getConfig()).toMatchObject({
        branchUserSuffix: "PGOMEZ",
        jiraEmail: "otro@example.com",
        jiraBaseUrl: "https://example.atlassian.net",
      });
    });

    it("saveConfig recorta los espacios de los textos, como AppConfigProvider", () => {
      fixture.orchestrator.saveConfig({ branchUserSuffix: "PGOMEZ ", jiraEmail: " otro@example.com " });

      expect(fixture.orchestrator.getConfig()).toMatchObject({ branchUserSuffix: "PGOMEZ", jiraEmail: "otro@example.com" });
    });

    it("saveConfig ignora un texto en blanco y conserva el valor guardado", () => {
      fixture.orchestrator.saveConfig({ jiraEmail: "   " });

      expect(fixture.orchestrator.getConfig()?.jiraEmail).toBe("dev@example.com");
    });

    it.each(["arocha", "A-R", "AR OCHA", ""])("saveConfig rechaza el sufijo «%s» y no cambia lo guardado", (suffix) => {
      expect(() => fixture.orchestrator.saveConfig({ branchUserSuffix: suffix })).toThrow(/\^\[A-Z0-9\]\+\$/);
      expect(fixture.orchestrator.getConfig()?.branchUserSuffix).toBe("AROCHA");
    });
  });

  describe("suggestBranchSuffix", () => {
    it.each([
      ["Andrea Rocha", "AROCHA"],
      ["Pedro Gómez", "PGOMEZ"],
      ["María José de la Peña", "MPENA"],
      ["  ana   lópez  ", "ALOPEZ"],
      ["Madonna", "MADONNA"],
    ])("«%s» → %s", async (displayName, expected) => {
      fixture.jira.getMyDisplayName.mockResolvedValue({ kind: "Ok", value: displayName });

      const result = await fixture.orchestrator.suggestBranchSuffix();

      expect(result).toEqual({ kind: "Ok", value: expected });
    });

    it("devuelve el fallo de Jira tal cual", async () => {
      const down = { kind: "FallbackManual", reason: "network_timeout" };
      fixture.jira.getMyDisplayName.mockResolvedValue(down);

      expect(await fixture.orchestrator.suggestBranchSuffix()).toEqual(down);
    });

    it("si el nombre no deja caracteres A-Z0-9 devuelve ErrorBloqueante que pide escribirlo a mano", async () => {
      fixture.jira.getMyDisplayName.mockResolvedValue({ kind: "Ok", value: "李雷" });

      const result = await fixture.orchestrator.suggestBranchSuffix();

      expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    });

    it("sin configuración de Jira indica ejecutar devflow config", async () => {
      const empty = setup(null);

      const result = await empty.orchestrator.suggestBranchSuffix();

      expect(result.kind === "ErrorBloqueante" && result.message).toContain("devflow config");
      empty.storage.close();
    });
  });

  describe("listAssignedTickets", () => {
    it("pasa a Jira las claves guardadas y devuelve su resultado", async () => {
      fixture.storage.upsertJiraProject({ jiraProjectKey: "SCRUM", jiraProjectName: "Scrum" });
      fixture.storage.upsertJiraProject({ jiraProjectKey: "API", jiraProjectName: "Api" });
      const tickets = { kind: "Ok", value: [{ ticketId: "API-1", title: "t", issueType: "Story" }] };
      fixture.jira.listAssignedTickets.mockResolvedValue(tickets);

      const result = await fixture.orchestrator.listAssignedTickets();

      expect(fixture.jira.listAssignedTickets).toHaveBeenCalledWith(["API", "SCRUM"]);
      expect(result).toEqual(tickets);
    });

    it("sin proyectos devuelve Ok([]) sin llamar a Jira", async () => {
      expect(await fixture.orchestrator.listAssignedTickets()).toEqual({ kind: "Ok", value: [] });
      expect(fixture.jira.listAssignedTickets).not.toHaveBeenCalled();
    });

    it("sin configuración de Jira devuelve ErrorBloqueante que indica devflow config, sin llamar a Jira", async () => {
      const empty = setup(null);

      const result = await empty.orchestrator.listAssignedTickets();

      expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
      expect(result.kind === "ErrorBloqueante" && result.message).toContain("devflow config");
      expect(empty.jira.listAssignedTickets).not.toHaveBeenCalled();
      empty.storage.close();
    });
  });
});
