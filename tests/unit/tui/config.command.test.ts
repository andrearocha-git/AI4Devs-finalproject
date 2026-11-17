import { describe, expect, it, vi } from "vitest";
import type { StepResult } from "../../../src/shared/errors/result.types.js";
import type { AppConfig } from "../../../src/shared/types/config.types.js";
import { runConfig, type ConfigOrchestrator } from "../../../src/tui/commands/config.command.js";
import type { ConfigPrompts, PromptOptions } from "../../../src/tui/prompts/project-config.prompt.js";

const ENV = { USERPROFILE: "C:\\Users\\andrea" };
const DEFAULT_ROOT = "C:\\Users\\andrea\\DevFlowCLI\\tickets";
/** Respuesta que equivale a pulsar Enter: se usa el valor por defecto del prompt. */
const ENTER = null;

interface Call {
  kind: "input" | "password";
  message: string;
  options: PromptOptions | undefined;
}

function scriptedPrompts(answers: { input: Array<string | null>; password: string[] }) {
  const calls: Call[] = [];
  const prompts: ConfigPrompts = {
    async input(message, options) {
      calls.push({ kind: "input", message, options });
      const answer = answers.input.shift();
      return answer === ENTER || answer === undefined ? (options?.default ?? "") : answer;
    },
    async password(message, options) {
      calls.push({ kind: "password", message, options });
      return answers.password.shift() ?? "";
    },
  };
  return { prompts, calls };
}

function existingConfig(): AppConfig {
  return {
    id: 1,
    jiraBaseUrl: "https://equipo.atlassian.net",
    jiraEmail: "dev@example.com",
    jiraApiToken: "token-guardado",
    jiraTimeoutSeconds: 10,
    ollamaHost: "http://localhost:11434",
    ollamaModel: "qwen2.5:3b",
    ollamaTimeoutSeconds: 120,
    branchPrefixFeature: "features",
    branchPrefixBugfix: "bugs",
    branchUserSuffix: "AROCHA",
    ticketsRootPath: "D:\\tickets",
    adjuntosDirName: "adjuntos",
    createdAt: "",
    updatedAt: "",
  };
}

function setup(options: { config?: AppConfig | null; suggestion?: StepResult<string> } = {}) {
  const orchestrator = {
    getConfig: vi.fn(() => options.config ?? null),
    saveConfig: vi.fn(),
    suggestBranchSuffix: vi.fn(async () => options.suggestion ?? ({ kind: "Ok", value: "AROCHA" } as StepResult<string>)),
  } satisfies ConfigOrchestrator;
  const lines: string[] = [];
  const run = (answers: { input: Array<string | null>; password: string[] }) => {
    const script = scriptedPrompts(answers);
    const done = runConfig({ orchestrator, prompts: script.prompts, out: (line) => lines.push(line), env: ENV });
    return { done, calls: script.calls };
  };
  return { orchestrator, lines, run };
}

const FIRST_RUN = { input: ["https://equipo.atlassian.net/", "dev@example.com", ENTER, ENTER], password: ["token-nuevo"] };

describe("E2 — devflow config", () => {
  it("primer arranque: pide los datos en orden, propone el sufijo con esas credenciales y guarda todo en una sola llamada", async () => {
    const { orchestrator, lines, run } = setup();

    const { done, calls } = run({ ...FIRST_RUN, input: [...FIRST_RUN.input] });
    await done;

    expect(calls.map((c) => c.kind)).toEqual(["input", "input", "password", "input", "input"]);
    expect(orchestrator.suggestBranchSuffix).toHaveBeenCalledWith({
      jiraBaseUrl: "https://equipo.atlassian.net/",
      jiraEmail: "dev@example.com",
      jiraApiToken: "token-nuevo",
    });
    expect(orchestrator.saveConfig).toHaveBeenCalledTimes(1);
    expect(orchestrator.saveConfig).toHaveBeenCalledWith({
      jiraBaseUrl: "https://equipo.atlassian.net/",
      jiraEmail: "dev@example.com",
      jiraApiToken: "token-nuevo",
      ticketsRootPath: DEFAULT_ROOT,
      branchUserSuffix: "AROCHA",
    });
    expect(lines.join("\n")).toContain("Configuración guardada");
  });

  it("propone el sufijo como valor por defecto y el usuario puede editarlo", async () => {
    const { orchestrator, run } = setup();

    const { done, calls } = run({ input: ["https://equipo.atlassian.net", "dev@example.com", ENTER, "PGOMEZ"], password: ["t"] });
    await done;

    expect(calls[4]?.options?.default).toBe("AROCHA");
    expect(orchestrator.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ branchUserSuffix: "PGOMEZ" }));
  });

  it("el token se pide enmascarado y nunca aparece en la salida", async () => {
    const { lines, run } = setup();

    const { done, calls } = run({ ...FIRST_RUN, input: [...FIRST_RUN.input], password: ["token-super-secreto"] });
    await done;

    expect(calls.find((c) => c.kind === "password")).toBeDefined();
    expect(lines.join("\n")).not.toContain("token-super-secreto");
  });

  it("valida cada respuesta: URL, email, token, carpeta y sufijo", async () => {
    const { run } = setup();

    const { done, calls } = run({ ...FIRST_RUN, input: [...FIRST_RUN.input] });
    await done;

    const [url, email, token, root, suffix] = calls.map((c) => c.options?.validate);
    expect(url?.("https://equipo.atlassian.net")).toBe(true);
    for (const bad of ["ftp://x", "equipo.atlassian.net", "https://u:p@x.net", "https://x.net?a=1", ""]) {
      expect(typeof url?.(bad)).toBe("string");
    }
    expect(email?.("dev@example.com")).toBe(true);
    expect(typeof email?.("  ")).toBe("string");
    expect(token?.("abc")).toBe(true);
    expect(typeof token?.("")).toBe("string");
    expect(root?.("C:\\tickets")).toBe(true);
    expect(typeof root?.(" ")).toBe("string");
    expect(suffix?.("PGOMEZ")).toBe(true);
    for (const bad of ["pgomez", "A-R", "AR OCHA", ""]) {
      expect(typeof suffix?.(bad)).toBe("string");
    }
  });

  it.each<[string, StepResult<string>, string]>([
    ["token inválido", { kind: "FallbackManual", reason: "invalid_token" }, "API Token"],
    ["Jira sin respuesta", { kind: "FallbackManual", reason: "network_timeout" }, "no respondió"],
    ["error bloqueante", { kind: "ErrorBloqueante", subtype: "ErrorInesperado", message: "respuesta rara de Jira" }, "respuesta rara de Jira"],
  ])("si Jira no puede sugerir el sufijo (%s) muestra el motivo y deja escribirlo a mano", async (_name, suggestion, expected) => {
    const { orchestrator, lines, run } = setup({ suggestion });

    const { done, calls } = run({ input: ["https://equipo.atlassian.net", "dev@example.com", ENTER, "PGOMEZ"], password: ["t"] });
    await done;

    expect(lines.join("\n")).toContain(expected);
    expect(lines.join("\n")).toContain("Escríbelo a mano");
    expect(calls[4]?.options?.default ?? "").toBe("");
    expect(orchestrator.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ branchUserSuffix: "PGOMEZ" }));
  });

  it("con configuración existente muestra los valores actuales por defecto y un token en blanco conserva el guardado", async () => {
    const { orchestrator, lines, run } = setup({ config: existingConfig() });

    const { done, calls } = run({ input: [ENTER, ENTER, ENTER, ENTER], password: [""] });
    await done;

    expect(calls.filter((c) => c.kind === "input").map((c) => c.options?.default)).toEqual([
      "https://equipo.atlassian.net",
      "dev@example.com",
      "D:\\tickets",
      "AROCHA",
    ]);
    expect(calls.find((c) => c.kind === "password")?.message).toContain("en blanco conserva");
    expect(calls.find((c) => c.kind === "password")?.options?.validate?.("")).toBe(true);
    expect(orchestrator.suggestBranchSuffix).not.toHaveBeenCalled();
    expect(orchestrator.saveConfig).toHaveBeenCalledWith({
      jiraBaseUrl: "https://equipo.atlassian.net",
      jiraEmail: "dev@example.com",
      jiraApiToken: "token-guardado",
      ticketsRootPath: "D:\\tickets",
      branchUserSuffix: "AROCHA",
    });
    expect(lines.join("\n")).not.toContain("token-guardado");
  });

  it("con configuración existente, un token nuevo reemplaza al guardado", async () => {
    const { orchestrator, run } = setup({ config: existingConfig() });

    const { done } = run({ input: [ENTER, ENTER, ENTER, ENTER], password: ["token-rotado"] });
    await done;

    expect(orchestrator.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ jiraApiToken: "token-rotado" }));
  });

  it("si saveConfig lanza, el error se propaga (lo traduce el programa) y no se confirma el guardado", async () => {
    const { orchestrator, lines, run } = setup();
    orchestrator.saveConfig.mockImplementation(() => {
      throw new Error("La URL de Jira no es válida");
    });

    const { done } = run({ ...FIRST_RUN, input: [...FIRST_RUN.input] });

    await expect(done).rejects.toThrow("La URL de Jira");
    expect(lines.join("\n")).not.toContain("Configuración guardada");
  });
});
