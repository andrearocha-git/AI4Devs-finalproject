import { readFileSync } from "node:fs";
import { CommanderError } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProgram, createHandlers } from "../../../src/tui/cli.js";
import type { ConfigOrchestrator } from "../../../src/tui/commands/config.command.js";
import type { ProjectsOrchestrator } from "../../../src/tui/commands/config-proyectos.command.js";
import type { ConfigPrompts, ProjectPrompts } from "../../../src/tui/prompts/project-config.prompt.js";

const version = (JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")) as { version: string }).version;

function setup() {
  const handlers = { config: vi.fn(async () => {}), configProyectos: vi.fn(async () => {}) };
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
  it("registra solo `config`, con el subcomando `proyectos`", () => {
    const { program } = setup();

    expect(program.name()).toBe("devflow");
    expect(program.commands.map((c) => c.name())).toEqual(["config"]);
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
