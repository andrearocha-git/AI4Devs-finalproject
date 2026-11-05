import { describe, expect, it, vi } from "vitest";
import type { StepResult } from "../../../src/shared/errors/result.types.js";
import type { JiraProject, Repository } from "../../../src/shared/types/config.types.js";
import { runConfigProyectos, type ProjectsOrchestrator } from "../../../src/tui/commands/config-proyectos.command.js";
import type { ProjectPrompts, PromptOptions, SelectChoice } from "../../../src/tui/prompts/project-config.prompt.js";

const ENTER = null;

const SCRUM: JiraProject = { id: 1, jiraProjectKey: "SCRUM", jiraProjectName: "Scrum Board", createdAt: "", updatedAt: "" };
const API: Repository = {
  id: 10,
  jiraProjectId: 1,
  name: "api",
  repoLocalPath: "/work/api",
  defaultBaseBranch: "develop",
  createdAt: "",
  updatedAt: "",
};

interface Answers {
  select: unknown[];
  input?: Array<string | null>;
  confirm?: boolean[];
}

interface Call {
  kind: "select" | "input" | "confirm";
  message: string;
  options?: PromptOptions;
  choices?: SelectChoice<unknown>[];
}

function scripted(answers: Answers) {
  const calls: Call[] = [];
  const prompts: ProjectPrompts = {
    async input(message, options) {
      calls.push({ kind: "input", message, ...(options ? { options } : {}) });
      const answer = answers.input?.shift();
      return answer === ENTER || answer === undefined ? (options?.default ?? "") : answer;
    },
    async select<T>(message: string, choices: SelectChoice<T>[]) {
      calls.push({ kind: "select", message, choices });
      const answer = answers.select.shift() as T;
      if (!choices.some((c) => Object.is(c.value, answer))) throw new Error(`Respuesta fuera de las opciones en «${message}»`);
      return answer;
    },
    async confirm(message) {
      calls.push({ kind: "confirm", message });
      return answers.confirm?.shift() ?? false;
    },
  };
  return { prompts, calls };
}

function setup(state: { projects?: JiraProject[]; repos?: Repository[] } = {}) {
  const projects = state.projects ?? [SCRUM];
  const repos = state.repos ?? [API];
  const orchestrator = {
    listProjects: vi.fn(() => projects),
    addProject: vi.fn(async (key: string): Promise<StepResult<JiraProject>> => ({ kind: "Ok", value: { ...SCRUM, jiraProjectKey: key.toUpperCase() } })),
    removeProject: vi.fn(),
    listRepositories: vi.fn((): StepResult<Repository[]> => ({ kind: "Ok", value: repos })),
    addRepository: vi.fn(async (): Promise<StepResult<Repository>> => ({ kind: "Ok", value: API })),
    updateRepository: vi.fn(async (): Promise<StepResult<Repository>> => ({ kind: "Ok", value: API })),
    removeRepository: vi.fn(),
  } satisfies ProjectsOrchestrator;
  const lines: string[] = [];
  const run = async (answers: Answers) => {
    const script = scripted({ ...answers, select: [...answers.select, "exit"] });
    await runConfigProyectos({ orchestrator, prompts: script.prompts, out: (line) => lines.push(line) });
    return script.calls;
  };
  return { orchestrator, lines, run, text: () => lines.join("\n") };
}

describe("E3 — devflow config proyectos", () => {
  describe("menú y listado", () => {
    it("el menú se repite hasta elegir salir", async () => {
      const { run, orchestrator } = setup();

      const calls = await run({ select: ["list", "list"] });

      expect(calls.filter((c) => c.message.includes("¿Qué quieres hacer?"))).toHaveLength(3);
      expect(orchestrator.listProjects).toHaveBeenCalledTimes(2);
    });

    it("lista cada clave con su nombre y sus repositorios con ruta y rama base", async () => {
      const { run, text } = setup();

      await run({ select: ["list"] });

      expect(text()).toContain("SCRUM");
      expect(text()).toContain("Scrum Board");
      expect(text()).toContain("api");
      expect(text()).toContain("/work/api");
      expect(text()).toContain("develop");
    });

    it("sin claves explica cómo empezar; una clave sin repositorios lo indica", async () => {
      const empty = setup({ projects: [] });
      await empty.run({ select: ["list"] });
      expect(empty.text()).toContain("Agregar clave");

      const noRepos = setup({ repos: [] });
      await noRepos.run({ select: ["list"] });
      expect(noRepos.text()).toContain("sin repositorios");
    });

    it("si no se pueden listar los repositorios de una clave, muestra el motivo y sigue", async () => {
      const { orchestrator, run, text } = setup();
      orchestrator.listRepositories.mockReturnValue({ kind: "ErrorBloqueante", subtype: "ErrorInesperado", message: "no se pudo leer" });

      await run({ select: ["list"] });

      expect(text()).toContain("no se pudo leer");
    });
  });

  describe("agregar clave", () => {
    it("con Ok confirma que quedó lista para usarse", async () => {
      const { orchestrator, run, text } = setup();

      await run({ select: ["addProject"], input: ["scrum"] });

      expect(orchestrator.addProject).toHaveBeenCalledWith("scrum");
      expect(text()).toContain("SCRUM");
      expect(text()).toContain("lista para usarse");
    });

    it.each<[string, StepResult<JiraProject>, string[], string[]]>([
      ["clave inexistente", { kind: "FallbackManual", reason: "not_found" }, ["no existe en Jira"], []],
      ["token inválido", { kind: "FallbackManual", reason: "invalid_token" }, ["API Token"], ["no existe"]],
      ["Jira sin respuesta", { kind: "FallbackManual", reason: "network_timeout" }, ["no respondió"], ["lista para usarse"]],
    ])("%s: mensaje propio, sin decir que quedó lista", async (_name, result, contains, notContains) => {
      const { orchestrator, run, text } = setup();
      orchestrator.addProject.mockResolvedValue(result);

      await run({ select: ["addProject"], input: ["ABC"] });

      for (const expected of contains) expect(text()).toContain(expected);
      for (const unexpected of notContains) expect(text()).not.toContain(unexpected);
      expect(text()).not.toContain("lista para usarse");
    });

    it("la clave en blanco no se acepta", async () => {
      const { run } = setup();

      const calls = await run({ select: ["addProject"], input: ["SCRUM"] });

      const validate = calls.find((c) => c.kind === "input")?.options?.validate;
      expect(typeof validate?.("  ")).toBe("string");
      expect(validate?.("SCRUM")).toBe(true);
    });
  });

  describe("agregar repositorio", () => {
    it("ofrece las claves dadas de alta, propone main y guarda", async () => {
      const { orchestrator, run, text } = setup();

      const calls = await run({ select: ["addRepo", "SCRUM"], input: ["backend", "/work/backend", ENTER] });

      const projectChoices = calls.find((c) => c.message.includes("clave"))?.choices;
      expect(projectChoices?.map((c) => c.value)).toEqual(["SCRUM"]);
      expect(calls.filter((c) => c.kind === "input").at(-1)?.options?.default).toBe("main");
      expect(orchestrator.addRepository).toHaveBeenCalledWith({
        jiraProjectKey: "SCRUM",
        name: "backend",
        repoLocalPath: "/work/backend",
        defaultBaseBranch: "main",
      });
      expect(text()).toContain("backend");
      expect(text()).toContain("agregado");
    });

    it("sin claves dadas de alta no pide nada y explica qué hacer", async () => {
      const { orchestrator, run, text } = setup({ projects: [] });

      await run({ select: ["addRepo"] });

      expect(orchestrator.addRepository).not.toHaveBeenCalled();
      expect(text()).toContain("Agregar clave");
    });

    it("si Git lo rechaza muestra el motivo y permite corregir sin perder lo escrito", async () => {
      const { orchestrator, run, text } = setup();
      orchestrator.addRepository
        .mockResolvedValueOnce({ kind: "ErrorBloqueante", subtype: "RepositorioNoEncontrado", message: "La ruta /work/x no es un repositorio Git." })
        .mockResolvedValueOnce({ kind: "Ok", value: API });

      const calls = await run({
        select: ["addRepo", "SCRUM"],
        input: ["backend", "/work/x", "main", ENTER, "/work/backend", ENTER],
        confirm: [true],
      });

      expect(text()).toContain("La ruta /work/x no es un repositorio Git.");
      const inputs = calls.filter((c) => c.kind === "input");
      expect(inputs[3]?.options?.default).toBe("backend");
      expect(inputs[4]?.options?.default).toBe("/work/x");
      expect(orchestrator.addRepository).toHaveBeenCalledTimes(2);
      expect(orchestrator.addRepository).toHaveBeenLastCalledWith(expect.objectContaining({ name: "backend", repoLocalPath: "/work/backend" }));
      expect(text()).toContain("agregado");
    });

    it("si Git lo rechaza y el usuario no quiere corregir, vuelve al menú sin más llamadas", async () => {
      const { orchestrator, run } = setup();
      orchestrator.addRepository.mockResolvedValue({ kind: "ErrorBloqueante", subtype: "RepositorioNoEncontrado", message: "no" });

      await run({ select: ["addRepo", "SCRUM"], input: ["backend", "/work/x", ENTER], confirm: [false] });

      expect(orchestrator.addRepository).toHaveBeenCalledTimes(1);
    });

    it("nombre y ruta no pueden quedar en blanco", async () => {
      const { run } = setup();

      const calls = await run({ select: ["addRepo", "SCRUM"], input: ["backend", "/work/backend", ENTER] });

      const [name, path] = calls.filter((c) => c.kind === "input").map((c) => c.options?.validate);
      expect(typeof name?.(" ")).toBe("string");
      expect(typeof path?.("")).toBe("string");
    });
  });

  describe("editar repositorio", () => {
    it("muestra ruta y rama actuales, reemplaza los datos y no cambia el nombre", async () => {
      const { orchestrator, run, text } = setup();

      const calls = await run({ select: ["editRepo", "SCRUM", API], input: ["/work/api2", ENTER] });

      const inputs = calls.filter((c) => c.kind === "input");
      expect(inputs.map((c) => c.options?.default)).toEqual(["/work/api", "develop"]);
      expect(orchestrator.updateRepository).toHaveBeenCalledWith({
        jiraProjectKey: "SCRUM",
        name: "api",
        repoLocalPath: "/work/api2",
        defaultBaseBranch: "develop",
      });
      expect(text()).toContain("actualizado");
    });

    it("una clave sin repositorios lo indica y no pregunta más", async () => {
      const { orchestrator, run, text } = setup({ repos: [] });

      await run({ select: ["editRepo", "SCRUM"] });

      expect(orchestrator.updateRepository).not.toHaveBeenCalled();
      expect(text()).toContain("sin repositorios");
    });

    it("si Git rechaza el cambio muestra el motivo y no dice que se actualizó", async () => {
      const { orchestrator, run, text } = setup();
      orchestrator.updateRepository.mockResolvedValue({ kind: "ErrorBloqueante", subtype: "RepositorioNoEncontrado", message: "ruta inválida" });

      await run({ select: ["editRepo", "SCRUM", API], input: [ENTER, ENTER], confirm: [false] });

      expect(text()).toContain("ruta inválida");
      expect(text()).not.toContain("actualizado");
    });
  });

  describe("quitar repositorio y clave", () => {
    it("quitar repositorio pide confirmación y, confirmada, lo quita por su id", async () => {
      const { orchestrator, run, text } = setup();

      await run({ select: ["removeRepo", "SCRUM", API], confirm: [true] });

      expect(orchestrator.removeRepository).toHaveBeenCalledWith(10);
      expect(text()).toContain("quitado");
    });

    it("sin confirmación no invoca al Orquestador", async () => {
      const { orchestrator, run, text } = setup();

      await run({ select: ["removeRepo", "SCRUM", API, "removeProject", "SCRUM"], confirm: [false, false] });

      expect(orchestrator.removeRepository).not.toHaveBeenCalled();
      expect(orchestrator.removeProject).not.toHaveBeenCalled();
      expect(text()).toContain("No se quitó nada");
    });

    it("quitar clave confirmada la quita avisando que también quita sus repositorios", async () => {
      const { orchestrator, run, text } = setup();

      const calls = await run({ select: ["removeProject", "SCRUM"], confirm: [true] });

      expect(calls.find((c) => c.kind === "confirm")?.message).toContain("repositorios");
      expect(orchestrator.removeProject).toHaveBeenCalledWith("SCRUM");
      expect(text()).toContain("quitada");
    });

    it("con historial, el mensaje claro del Orquestador se muestra tal cual y el menú continúa", async () => {
      const { orchestrator, run, text } = setup();
      const message = "No se puede quitar el repositorio #10: tiene tickets registrados en el historial.";
      orchestrator.removeRepository.mockImplementation(() => {
        throw new Error(message);
      });
      orchestrator.removeProject.mockImplementation(() => {
        throw new Error("No se puede quitar el proyecto SCRUM: tiene tickets registrados en el historial.");
      });

      await run({ select: ["removeRepo", "SCRUM", API, "removeProject", "SCRUM"], confirm: [true, true] });

      expect(text()).toContain(message);
      expect(text()).toContain("No se puede quitar el proyecto SCRUM");
      expect(text()).not.toContain("quitado");
      expect(text()).not.toContain("quitada");
    });

    it("sin claves no ofrece quitar nada y lo explica", async () => {
      const { orchestrator, run, text } = setup({ projects: [] });

      await run({ select: ["removeProject"] });

      expect(orchestrator.removeProject).not.toHaveBeenCalled();
      expect(text()).toContain("Agregar clave");
    });
  });
});
