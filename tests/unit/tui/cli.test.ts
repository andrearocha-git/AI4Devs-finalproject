import { readFileSync } from "node:fs";
import { CommanderError } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProgram, createHandlers } from "../../../src/tui/cli.js";
import type { StartOrchestrator } from "../../../src/tui/commands/start.command.js";
import type { ConfigOrchestrator } from "../../../src/tui/commands/config.command.js";
import type { ProjectsOrchestrator } from "../../../src/tui/commands/config-proyectos.command.js";
import type { ConfigPrompts, ProjectPrompts } from "../../../src/tui/prompts/project-config.prompt.js";

const version = (JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")) as { version: string }).version;

function setup() {
  const handlers = { config: vi.fn(async () => {}), configProyectos: vi.fn(async () => {}), start: vi.fn(async () => {}) };
  const out: string[] = [];
  const err: string[] = [];
  const program = buildProgram(handlers, {
    exitOverride: true,
    writeOut: (text) => out.push(text),
    writeErr: (text) => err.push(text),
  });
  const run = (...args: string[]) => program.parseAsync(["node", "devflow", ...args]);
  return { handlers, out, err, program, run };
}

let savedExitCode: typeof process.exitCode;
beforeEach(() => {
  savedExitCode = process.exitCode;
});
afterEach(() => {
  process.exitCode = savedExitCode;
});

describe("E1 — buildProgram (Commander)", () => {
  it("registra solo `config` (con el subcomando `proyectos`) y `start`", () => {
    const { program } = setup();

    expect(program.name()).toBe("devflow");
    expect(program.commands.map((c) => c.name())).toEqual(["config", "start"]);
    expect(program.commands[0]?.commands.map((c) => c.name())).toEqual(["proyectos"]);
  });

  it("la ayuda lista `config` y la de `config` lista `proyectos`", async () => {
    const { run, out } = setup();

    await expect(run("--help")).rejects.toBeInstanceOf(CommanderError);
    await expect(run("config", "--help")).rejects.toBeInstanceOf(CommanderError);

    expect(out.join("")).toContain("config");
    expect(out.join("")).toContain("proyectos");
  });

  it("--version muestra la versión de package.json", async () => {
    const { run, out } = setup();

    await expect(run("--version")).rejects.toBeInstanceOf(CommanderError);

    expect(out.join("").trim()).toBe(version);
  });

  it("`devflow config` invoca su manejador una sola vez y no el de proyectos", async () => {
    const { run, handlers } = setup();

    await run("config");

    expect(handlers.config).toHaveBeenCalledTimes(1);
    expect(handlers.configProyectos).not.toHaveBeenCalled();
  });

  it("`devflow config proyectos` invoca su manejador una sola vez y no el de config", async () => {
    const { run, handlers } = setup();

    await run("config", "proyectos");

    expect(handlers.configProyectos).toHaveBeenCalledTimes(1);
    expect(handlers.config).not.toHaveBeenCalled();
  });

  it("un comando desconocido falla con el mensaje de Commander y código distinto de cero", async () => {
    const { run, err, handlers } = setup();

    const error = await run("inexistente").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CommanderError);
    expect((error as CommanderError).exitCode).not.toBe(0);
    expect(err.join("")).toContain("unknown command 'inexistente'");
    expect(handlers.config).not.toHaveBeenCalled();
  });

  it("un manejador que lanza se traduce a un mensaje claro y exitCode 1, sin excepción cruda", async () => {
    const { run, err, handlers } = setup();
    handlers.config.mockRejectedValue(new Error("disco lleno"));

    await expect(run("config")).resolves.toBeDefined();

    expect(err.join("")).toContain("disco lleno");
    expect(process.exitCode).toBe(1);
  });
});

describe("E1 — Ctrl+C", () => {
  it("cancelar un prompt (ExitPromptError) termina sin mensaje ni traza y con código 130", async () => {
    const { run, err, handlers } = setup();
    handlers.config.mockRejectedValue(Object.assign(new Error("User force closed the prompt"), { name: "ExitPromptError" }));

    await run("config");

    expect(err.join("")).toBe("");
    expect(process.exitCode).toBe(130);
  });
});

describe("E1 — createHandlers (arranque real)", () => {
  type Orchestrator = ConfigOrchestrator & ProjectsOrchestrator;

  function fakeOrchestrator(): Orchestrator {
    return {
      getConfig: vi.fn(() => null),
      saveConfig: vi.fn(),
      suggestBranchSuffix: vi.fn(async () => ({ kind: "Ok", value: "AROCHA" }) as const),
      listProjects: vi.fn(() => []),
      addProject: vi.fn(),
      removeProject: vi.fn(),
      listRepositories: vi.fn(),
      addRepository: vi.fn(),
      updateRepository: vi.fn(),
      removeRepository: vi.fn(),
    } as unknown as Orchestrator;
  }

  function prompts(): ConfigPrompts & ProjectPrompts {
    return {
      input: vi.fn(async (_message: string, options?: { default?: string }) => options?.default ?? "https://equipo.atlassian.net"),
      password: vi.fn(async () => "token"),
      select: vi.fn(async () => "exit"),
      confirm: vi.fn(async () => false),
    } as unknown as ConfigPrompts & ProjectPrompts;
  }

  it("no crea el Orquestador hasta que se ejecuta un comando (así --help no toca la base)", async () => {
    const getOrchestrator = vi.fn(fakeOrchestrator);
    const handlers = createHandlers({ getOrchestrator, prompts: prompts(), out: () => {}, env: {} });
    const program = buildProgram(handlers, { exitOverride: true, writeOut: () => {}, writeErr: () => {} });

    await expect(program.parseAsync(["node", "devflow", "--help"])).rejects.toBeInstanceOf(CommanderError);

    expect(getOrchestrator).not.toHaveBeenCalled();
  });

  it("`config proyectos` crea el Orquestador una vez y ejecuta el menú real hasta salir", async () => {
    const orchestrator = fakeOrchestrator();
    const getOrchestrator = vi.fn(() => orchestrator);
    const realPrompts = prompts();
    const handlers = createHandlers({ getOrchestrator, prompts: realPrompts, out: () => {}, env: {} });

    await handlers.configProyectos();

    expect(getOrchestrator).toHaveBeenCalledTimes(1);
    expect(realPrompts.select).toHaveBeenCalledTimes(1);
  });

  it("`config` ejecuta el flujo real de configuración con el Orquestador y escribe por `out`", async () => {
    const orchestrator = fakeOrchestrator();
    const lines: string[] = [];
    const handlers = createHandlers({
      getOrchestrator: () => orchestrator,
      prompts: prompts(),
      out: (line) => lines.push(line),
      env: { USERPROFILE: "C:\\Users\\andrea" },
    });

    await handlers.config();

    expect(orchestrator.saveConfig).toHaveBeenCalledTimes(1);
    expect(lines.join("\n")).toContain("Configuración guardada");
  });
});

describe("TK-03b1 · E3 — registro de `devflow start`", () => {
  it("registra `start` con `--base <rama>` y `--reprocesar`", () => {
    const { program } = setup();

    const start = program.commands.find((c) => c.name() === "start");

    expect(start?.registeredArguments.map((a) => a.name())).toEqual(["ID"]);
    expect(start?.registeredArguments[0]?.required).toBe(false);
    expect(start?.options.map((o) => o.long)).toEqual(["--base", "--reprocesar"]);
  });

  it("la ayuda de `devflow` lista `start` y la de `start` lista sus dos opciones", async () => {
    const { run, out } = setup();

    await expect(run("--help")).rejects.toBeInstanceOf(CommanderError);
    expect(out.join("")).toContain("start");
    out.length = 0;
    await expect(run("start", "--help")).rejects.toBeInstanceOf(CommanderError);

    expect(out.join("")).toContain("--base");
    expect(out.join("")).toContain("--reprocesar");
  });

  it("`devflow start SCRUM-12 --base develop --reprocesar` entrega el ID y las opciones al manejador", async () => {
    const { run, handlers } = setup();

    await run("start", "SCRUM-12", "--base", "develop", "--reprocesar");

    expect(handlers.start).toHaveBeenCalledTimes(1);
    expect(handlers.start).toHaveBeenCalledWith("SCRUM-12", { base: "develop", reprocesar: true });
    expect(handlers.config).not.toHaveBeenCalled();
  });

  it("`devflow start` sin ID ni opciones entrega `undefined` y un objeto vacío", async () => {
    const { run, handlers } = setup();

    await run("start");

    expect(handlers.start).toHaveBeenCalledWith(undefined, {});
  });

  it("un manejador de `start` que lanza se muestra como mensaje con código 1, sin traza", async () => {
    const { run, err, handlers } = setup();
    handlers.start.mockRejectedValue(new Error("Primero configura una clave"));

    await run("start");

    expect(err.join("")).toContain("Primero configura una clave");
    expect(process.exitCode).toBe(1);
  });

  it("Ctrl+C durante `start` termina en silencio con código 130", async () => {
    const { run, err, handlers } = setup();
    handlers.start.mockRejectedValue(Object.assign(new Error("User force closed the prompt"), { name: "ExitPromptError" }));

    await run("start", "SCRUM-12");

    expect(err.join("")).toBe("");
    expect(process.exitCode).toBe(130);
  });
});

describe("TK-03b1 · E3 — createHandlers: `start`", () => {
  const SUMMARY = { ticketId: "SCRUM-12", repositoryId: null, issueType: "Story", branchName: null, branchStatus: null, folderPath: null, documentPath: null, jiraFetchStatus: "ok", ollamaStatus: "ok" } as const;

  function startOrchestrator() {
    return {
      listProjects: vi.fn(() => [{ id: 1, jiraProjectKey: "SCRUM", jiraProjectName: "Scrum", createdAt: "", updatedAt: "" }]),
      listAssignedTickets: vi.fn(),
      listRepositoriesForTicket: vi.fn(() => ({ kind: "Ok", value: [] }) as const),
      startTicket: vi.fn<StartOrchestrator["startTicket"]>(async () => SUMMARY),
    } satisfies Record<keyof StartOrchestrator, unknown>;
  }

  const unusedConfigDeps = {
    getOrchestrator: vi.fn(() => {
      throw new Error("no debería pedirse el Orquestador de configuración");
    }),
    prompts: {} as never,
    out: () => {},
    env: {},
  };

  it("no pide el Orquestador de `start` hasta que se ejecuta el comando", () => {
    const getStartOrchestrator = vi.fn(startOrchestrator);

    createHandlers({ ...unusedConfigDeps, getStartOrchestrator: getStartOrchestrator as never });

    expect(getStartOrchestrator).not.toHaveBeenCalled();
  });

  it("`start` ejecuta el flujo real con el Orquestador y le pasa la rama base y el reproceso", async () => {
    const orchestrator = startOrchestrator();
    const handlers = createHandlers({ ...unusedConfigDeps, getStartOrchestrator: (() => orchestrator) as never });

    await handlers.start("SCRUM-12", { base: "develop", reprocesar: true });

    expect(orchestrator.startTicket).toHaveBeenCalledWith({ ticketId: "SCRUM-12", baseBranchOverride: "develop", reprocessFase1: true }, expect.anything());
  });

  const progressSpy = () => ({ onStep: vi.fn(), pause: vi.fn(), resume: vi.fn(), cancel: vi.fn(), stop: vi.fn() });

  it("`onStep` llega a la vista de progreso y `ask` entrega la carga manual y la confirmación a los prompts", async () => {
    const orchestrator = startOrchestrator();
    const progress = progressSpy();
    const askPrompts = {
      manualTicketEntry: { ask: vi.fn(async () => ({ title: "Falla el login", description: "Pasos", isBug: true })) },
      confirmActions: { ask: vi.fn(async () => false) },
    };
    const handlers = createHandlers({ ...unusedConfigDeps, getStartOrchestrator: (() => orchestrator) as never, askPrompts, progress, out: () => {} });

    await handlers.start("SCRUM-12", {});

    const hooks = orchestrator.startTicket.mock.calls[0]?.[1] as unknown as { onStep: (...a: unknown[]) => void; ask: (r: unknown) => Promise<unknown> };
    const summary = { ticketId: "SCRUM-12", issueType: "Story", repositoryName: null, branchName: null, baseBranch: null, folderPath: "/t", branchAlreadyExists: false, reprocessFase1: false };
    hooks.onStep("jira", "started");
    expect(progress.onStep).toHaveBeenCalledWith("jira", "started", undefined);
    await expect(hooks.ask({ kind: "manualTicket", ticketId: "SCRUM-12", reason: "not_found" })).resolves.toEqual({
      title: "Falla el login",
      description: "Pasos",
      issueType: "Bug",
    });
    await expect(hooks.ask({ kind: "confirmActions", summary })).resolves.toBe(false);
    expect(askPrompts.confirmActions.ask).toHaveBeenCalledWith(summary);
  });

  it("pausa el progreso alrededor de cada pregunta y lo cancela si no se confirma", async () => {
    const orchestrator = startOrchestrator();
    const progress = progressSpy();
    const askPrompts = {
      manualTicketEntry: { ask: vi.fn(async () => ({ title: "t", description: "d", isBug: false })) },
      confirmActions: { ask: vi.fn(async () => false) },
    };
    const handlers = createHandlers({ ...unusedConfigDeps, getStartOrchestrator: (() => orchestrator) as never, askPrompts, progress, out: () => {} });
    await handlers.start("SCRUM-12", {});
    const hooks = orchestrator.startTicket.mock.calls[0]?.[1] as unknown as { ask: (r: unknown) => Promise<unknown> };

    await hooks.ask({ kind: "manualTicket", ticketId: "SCRUM-12", reason: "not_found" });
    expect(progress.pause).toHaveBeenCalledTimes(1);
    expect(progress.resume).toHaveBeenCalledTimes(1);

    await hooks.ask({ kind: "confirmActions", summary: {} });
    expect(progress.pause).toHaveBeenCalledTimes(2);
    expect(progress.cancel).toHaveBeenCalledTimes(1);
    expect(progress.resume).toHaveBeenCalledTimes(1);
  });

  it("detiene la vista de progreso al terminar, también cuando el flujo falla", async () => {
    const ok = startOrchestrator();
    const failing = startOrchestrator();
    failing.startTicket.mockRejectedValue(new Error("se cayó"));
    const progressOk = progressSpy();
    const progressFail = progressSpy();

    await createHandlers({ ...unusedConfigDeps, getStartOrchestrator: (() => ok) as never, progress: progressOk, out: () => {} }).start("SCRUM-12", {});
    await expect(
      createHandlers({ ...unusedConfigDeps, getStartOrchestrator: (() => failing) as never, progress: progressFail, out: () => {} }).start("SCRUM-12", {}),
    ).rejects.toThrow("se cayó");

    expect(progressOk.stop).toHaveBeenCalledTimes(1);
    expect(progressFail.stop).toHaveBeenCalledTimes(1);
  });

  it("sin Orquestador de `start` el manejador falla con un mensaje claro en lugar de una excepción cruda", async () => {
    const handlers = createHandlers({ ...unusedConfigDeps });

    await expect(handlers.start("SCRUM-12", {})).rejects.toThrow(/no está disponible/);
  });
});
