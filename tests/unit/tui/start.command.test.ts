import { describe, expect, it, vi } from "vitest";
import type { StepResult } from "../../../src/shared/errors/result.types.js";
import type { JiraProject, Repository } from "../../../src/shared/types/config.types.js";
import type { StartTicketHooks, TicketRunSummary } from "../../../src/shared/types/ticket-run.types.js";
import { runStart, type StartOrchestrator } from "../../../src/tui/commands/start.command.js";
import type { RepositorySelectionPrompt } from "../../../src/tui/prompts/repository-selection.prompt.js";
import type { TicketSelectionPrompt } from "../../../src/tui/prompts/ticket-selection.prompt.js";

const SCRUM: JiraProject = { id: 1, jiraProjectKey: "SCRUM", jiraProjectName: "Scrum Board", createdAt: "", updatedAt: "" };

const SUMMARY: TicketRunSummary = {
  ticketId: "SCRUM-12",
  repositoryId: null,
  issueType: "Story",
  branchName: null,
  branchStatus: null,
  folderPath: null,
  documentPath: null,
  jiraFetchStatus: "ok",
  ollamaStatus: "ok",
};

function repo(id: number, name: string): Repository {
  return { id, jiraProjectId: 1, name, repoLocalPath: `/work/${name}`, defaultBaseBranch: "main", createdAt: "", updatedAt: "" };
}

interface State {
  projects?: JiraProject[];
  repos?: Repository[];
  repoResult?: StepResult<Repository[]>;
  tickets?: StepResult<Array<{ ticketId: string; title: string; issueType: string }>>;
  pickTicket?: string;
  pickRepository?: number;
}

function setup(state: State = {}) {
  const orchestrator = {
    listProjects: vi.fn(() => state.projects ?? [SCRUM]),
    listAssignedTickets: vi.fn(async () => state.tickets ?? { kind: "Ok" as const, value: [] }),
    listRepositoriesForTicket: vi.fn((): StepResult<Repository[]> => state.repoResult ?? { kind: "Ok", value: state.repos ?? [] }),
    startTicket: vi.fn<StartOrchestrator["startTicket"]>(async () => SUMMARY),
  } satisfies StartOrchestrator;
  const ticketSelection = { ask: vi.fn(async () => state.pickTicket ?? "SCRUM-12") } satisfies TicketSelectionPrompt;
  const repositorySelection = { ask: vi.fn(async () => state.pickRepository ?? 0) } satisfies RepositorySelectionPrompt;
  const hooks: StartTicketHooks = { onStep: vi.fn(), ask: vi.fn() as unknown as StartTicketHooks["ask"] };
  const lines: string[] = [];
  const run = (id: string | undefined, options: { base?: string; reprocesar?: boolean } = {}) =>
    runStart({ orchestrator, prompts: { ticketSelection, repositorySelection }, hooks, out: (line) => lines.push(line) }, id, options);
  return { orchestrator, ticketSelection, repositorySelection, hooks, lines, run };
}

function expectNothingCalled(orchestrator: ReturnType<typeof setup>["orchestrator"]): void {
  expect(orchestrator.listProjects).not.toHaveBeenCalled();
  expect(orchestrator.listAssignedTickets).not.toHaveBeenCalled();
  expect(orchestrator.listRepositoriesForTicket).not.toHaveBeenCalled();
  expect(orchestrator.startTicket).not.toHaveBeenCalled();
}

describe("TK-03b1 · E1 — validación del ID y aviso de «sin claves»", () => {
  it.each(["", "SCRUM", "12", "-5", "SCR UM-1"])("el ID «%s» mal formado falla con un ejemplo y sin invocar al Orquestador", async (id) => {
    const { run, orchestrator } = setup();

    await expect(run(id)).rejects.toThrow(/SCRUM-12/);

    expectNothingCalled(orchestrator);
  });

  it.each(["scrum-2", "A-1"])("el ID «%s» válido pasa la validación y llega al Orquestador tal cual", async (id) => {
    const { run, orchestrator } = setup();

    await run(id);

    expect(orchestrator.listRepositoriesForTicket).toHaveBeenCalledWith(id);
    expect(orchestrator.startTicket).toHaveBeenCalledTimes(1);
  });

  it("con una clave no configurada muestra el mensaje del Orquestador (claves disponibles) y no llama a startTicket", async () => {
    const message = "La clave ABC no está configurada. Claves disponibles: SCRUM.";
    const { run, orchestrator } = setup({ repoResult: { kind: "ErrorBloqueante", subtype: "ErrorInesperado", message } });

    await expect(run("ABC-1")).rejects.toThrow(message);

    expect(orchestrator.startTicket).not.toHaveBeenCalled();
  });

  it("sin ninguna clave configurada avisa «primero configura una clave» y no consulta a Jira ni inicia el flujo", async () => {
    const { run, orchestrator } = setup({ projects: [] });

    await expect(run("SCRUM-12")).rejects.toThrow(/primero configura una clave.*devflow config proyectos/is);

    expect(orchestrator.listAssignedTickets).not.toHaveBeenCalled();
    expect(orchestrator.listRepositoriesForTicket).not.toHaveBeenCalled();
    expect(orchestrator.startTicket).not.toHaveBeenCalled();
  });

  it("sin claves y sin ID también avisa antes de pedir la lista de asignados", async () => {
    const { run, orchestrator } = setup({ projects: [] });

    await expect(run(undefined)).rejects.toThrow(/primero configura una clave/i);

    expect(orchestrator.listAssignedTickets).not.toHaveBeenCalled();
  });
});

describe("TK-03b1 · E2 — sin ID: lista de tickets asignados", () => {
  const TICKETS = [
    { ticketId: "SCRUM-12", title: "Login con SSO", issueType: "Story" },
    { ticketId: "SCRUM-15", title: "Error al exportar", issueType: "Bug" },
    { ticketId: "SCRUM-20", title: "Reporte mensual", issueType: "Task" },
  ];

  it("el prompt recibe exactamente los tickets del Orquestador y el ID elegido sigue al flujo", async () => {
    const { run, orchestrator, ticketSelection } = setup({ tickets: { kind: "Ok", value: TICKETS }, pickTicket: "SCRUM-15" });

    const summary = await run(undefined);

    expect(ticketSelection.ask).toHaveBeenCalledTimes(1);
    expect(ticketSelection.ask).toHaveBeenCalledWith(TICKETS);
    expect(orchestrator.listRepositoriesForTicket).toHaveBeenCalledWith("SCRUM-15");
    expect(orchestrator.startTicket).toHaveBeenCalledWith(expect.objectContaining({ ticketId: "SCRUM-15" }), expect.anything());
    expect(summary).toBe(SUMMARY);
  });

  it("con la lista vacía informa que no hay tickets asignados y termina sin error ni startTicket", async () => {
    const { run, orchestrator, ticketSelection, lines } = setup({ tickets: { kind: "Ok", value: [] } });

    const summary = await run(undefined);

    expect(summary).toBeUndefined();
    expect(lines.join("\n")).toMatch(/no tienes tickets asignados/i);
    expect(ticketSelection.ask).not.toHaveBeenCalled();
    expect(orchestrator.startTicket).not.toHaveBeenCalled();
  });

  it("un token inválido se traduce con describeFailure y no se presenta como «no existe»", async () => {
    const { run, orchestrator, ticketSelection } = setup({ tickets: { kind: "FallbackManual", reason: "invalid_token" } });

    await expect(run(undefined)).rejects.toThrow(/rechazó el email o el API Token/);
    await expect(run(undefined)).rejects.not.toThrow(/no existe|no encontr/i);

    expect(ticketSelection.ask).not.toHaveBeenCalled();
    expect(orchestrator.startTicket).not.toHaveBeenCalled();
  });

  it("si Jira no responde lo explica y no inicia el flujo", async () => {
    const { run, orchestrator } = setup({ tickets: { kind: "FallbackManual", reason: "network_timeout" } });

    await expect(run(undefined)).rejects.toThrow(/Jira no respondió/);

    expect(orchestrator.startTicket).not.toHaveBeenCalled();
  });

  it("un error bloqueante del Orquestador se muestra con su mensaje", async () => {
    const message = "Falta la configuración de Jira. Ejecuta «devflow config» primero.";
    const { run } = setup({ tickets: { kind: "ErrorBloqueante", subtype: "ErrorInesperado", message } });

    await expect(run(undefined)).rejects.toThrow(message);
  });

  it("con un ID en la línea de comandos no pide la lista de asignados ni el prompt de ticket", async () => {
    const { run, orchestrator, ticketSelection } = setup();

    await run("SCRUM-12");

    expect(orchestrator.listAssignedTickets).not.toHaveBeenCalled();
    expect(ticketSelection.ask).not.toHaveBeenCalled();
  });
});

describe("TK-03b1 · E3 — repositorio y flags", () => {
  it("con varios repositorios pide elegir y startTicket recibe el repositoryId elegido", async () => {
    const repos = [repo(10, "api"), repo(11, "web")];
    const { run, orchestrator, repositorySelection } = setup({ repos, pickRepository: 11 });

    await run("SCRUM-12");

    expect(repositorySelection.ask).toHaveBeenCalledTimes(1);
    expect(repositorySelection.ask).toHaveBeenCalledWith([
      { id: 10, name: "api", repoLocalPath: "/work/api" },
      { id: 11, name: "web", repoLocalPath: "/work/web" },
    ]);
    expect(orchestrator.startTicket).toHaveBeenCalledWith({ ticketId: "SCRUM-12", repositoryId: 11 }, expect.anything());
  });

  it("con un solo repositorio lo preselecciona sin mostrar el prompt", async () => {
    const { run, orchestrator, repositorySelection } = setup({ repos: [repo(10, "api")] });

    await run("SCRUM-12");

    expect(repositorySelection.ask).not.toHaveBeenCalled();
    expect(orchestrator.startTicket).toHaveBeenCalledWith({ ticketId: "SCRUM-12", repositoryId: 10 }, expect.anything());
  });

  it("sin repositorios no muestra el prompt y la entrada no lleva la clave repositoryId", async () => {
    const { run, orchestrator, repositorySelection } = setup({ repos: [] });

    await run("SCRUM-12");

    expect(repositorySelection.ask).not.toHaveBeenCalled();
    const input = orchestrator.startTicket.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(input).toEqual({ ticketId: "SCRUM-12" });
    expect("repositoryId" in input).toBe(false);
  });

  it("--base y --reprocesar llegan como baseBranchOverride y reprocessFase1", async () => {
    const { run, orchestrator } = setup({ repos: [repo(10, "api")] });

    await run("SCRUM-12", { base: "develop", reprocesar: true });

    expect(orchestrator.startTicket).toHaveBeenCalledWith(
      { ticketId: "SCRUM-12", repositoryId: 10, baseBranchOverride: "develop", reprocessFase1: true },
      expect.anything(),
    );
  });

  it("sin flags ninguna de las dos claves aparece en la entrada", async () => {
    const { run, orchestrator } = setup();

    await run("SCRUM-12", {});
    await run("SCRUM-12", { reprocesar: false });

    for (const call of orchestrator.startTicket.mock.calls) {
      const input = call[0] as unknown as Record<string, unknown>;
      expect("baseBranchOverride" in input).toBe(false);
      expect("reprocessFase1" in input).toBe(false);
    }
  });

  it("startTicket recibe los ganchos que entrega el programa", async () => {
    const { run, orchestrator, hooks } = setup();

    await run("SCRUM-12");

    expect(orchestrator.startTicket.mock.calls[0]?.[1]).toBe(hooks);
  });

  it("con el ID elegido de la lista también pasa por la selección de repositorio", async () => {
    const { run, repositorySelection, orchestrator } = setup({
      tickets: { kind: "Ok", value: [{ ticketId: "SCRUM-15", title: "x", issueType: "Bug" }] },
      pickTicket: "SCRUM-15",
      repos: [repo(10, "api"), repo(11, "web")],
      pickRepository: 10,
    });

    await run(undefined, { base: "develop" });

    expect(repositorySelection.ask).toHaveBeenCalledTimes(1);
    expect(orchestrator.startTicket).toHaveBeenCalledWith(
      { ticketId: "SCRUM-15", repositoryId: 10, baseBranchOverride: "develop" },
      expect.anything(),
    );
  });
});

describe("TK-03b1 · E3 — cortes de startTicket (provisional hasta TK-03b3)", () => {
  it.each([
    { subtype: "TipoIssueBloqueado", message: "SCRUM-1 es una épica: elige un ticket que no lo sea." },
    { subtype: "ErrorInesperado", message: "Jira rechazó el email o el API Token. Revisa que sean correctos." },
    { subtype: "CambiosPendientes", message: "El repositorio api tiene cambios sin guardar:\n M src/a.ts" },
    { subtype: "RamaExistenteEnRemoto", message: "La rama features/SCRUM-12-AROCHA solo existe en origin." },
  ])("un resumen blocked ($subtype) se muestra con su mensaje y el comando falla en lugar de terminar en silencio", async ({ subtype, message }) => {
    const { run, orchestrator } = setup();
    orchestrator.startTicket.mockResolvedValueOnce({ ...SUMMARY, blocked: { subtype, message } });

    await expect(run("SCRUM-12")).rejects.toThrow(message);
  });

  it("un resumen sin blocked se devuelve tal cual y no lanza", async () => {
    const { run } = setup();

    await expect(run("SCRUM-12")).resolves.toBe(SUMMARY);
  });
});
