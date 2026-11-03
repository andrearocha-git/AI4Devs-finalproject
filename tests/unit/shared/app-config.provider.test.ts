import { describe, expect, it } from "vitest";
import { AppConfigProvider, resolveDatabasePath } from "../../../src/shared/config/app-config.provider.js";

const env = { APPDATA: "C:\\Users\\dev\\AppData\\Roaming", USERPROFILE: "C:\\Users\\dev" };

const required = {
  jiraBaseUrl: "https://equipo.atlassian.net",
  jiraEmail: "dev@example.com",
  jiraApiToken: "token-de-prueba",
  branchUserSuffix: "AROCHA",
};

describe("E2 — AppConfigProvider (TK-02a CA3)", () => {
  it("acepta la configuración con los campos obligatorios y aplica los valores por defecto", () => {
    const config = new AppConfigProvider(required, { env }).config;
    expect(config).toEqual({
      ...required,
      jiraTimeoutSeconds: 10,
      ollamaHost: "http://localhost:11434",
      ollamaModel: "qwen2.5:3b",
      ollamaTimeoutSeconds: 120,
      branchPrefixFeature: "features",
      branchPrefixBugfix: "bugs",
      adjuntosDirName: "adjuntos",
      ticketsRootPath: "C:\\Users\\dev\\DevFlowCLI\\tickets",
      databasePath: "C:\\Users\\dev\\AppData\\Roaming\\DevFlowCLI\\devflow.db",
    });
  });

  it("respeta los valores explícitos en lugar de los de por defecto", () => {
    const config = new AppConfigProvider(
      { ...required, ollamaTimeoutSeconds: 200, ticketsRootPath: "D:\\tickets", databasePath: "D:\\db\\x.db" },
      { env },
    ).config;
    expect(config.ollamaTimeoutSeconds).toBe(200);
    expect(config.ticketsRootPath).toBe("D:\\tickets");
    expect(config.databasePath).toBe("D:\\db\\x.db");
  });

  it.each(["jiraBaseUrl", "jiraEmail", "jiraApiToken", "branchUserSuffix"] as const)(
    "rechaza la configuración sin %s e indica el campo",
    (field) => {
      const incomplete: Record<string, string> = { ...required };
      delete incomplete[field];
      expect(() => new AppConfigProvider(incomplete, { env })).toThrow(field);
    },
  );

  it("trata una cadena vacía como campo ausente y lista todos los que faltan", () => {
    expect(() => new AppConfigProvider({ ...required, jiraEmail: "", jiraApiToken: "  " }, { env })).toThrow(
      /jiraEmail.*jiraApiToken/,
    );
  });

  it.each(["arocha", "A-ROCHA", "A ROCHA"])("rechaza el sufijo de rama inválido %j", (branchUserSuffix) => {
    expect(() => new AppConfigProvider({ ...required, branchUserSuffix }, { env })).toThrow("branchUserSuffix");
  });

  it("rechaza si faltan USERPROFILE o APPDATA y no hay valor explícito", () => {
    expect(() => new AppConfigProvider(required, { env: {} })).toThrow(/ticketsRootPath.*databasePath/);
  });

  it("devuelve una configuración inmutable", () => {
    const config = new AppConfigProvider(required, { env }).config as unknown as Record<string, unknown>;
    expect(Object.isFrozen(config)).toBe(true);
    expect(() => {
      config.jiraEmail = "otro@example.com";
    }).toThrow(TypeError);
  });

  it("no se ve afectada por cambios posteriores en el objeto de entrada", () => {
    const input = { ...required };
    const config = new AppConfigProvider(input, { env }).config;
    input.jiraEmail = "otro@example.com";
    expect(config.jiraEmail).toBe("dev@example.com");
  });
});

describe("resolveDatabasePath", () => {
  it("calcula %APPDATA%\\DevFlowCLI\\devflow.db", () => {
    expect(resolveDatabasePath(env)).toBe("C:\\Users\\dev\\AppData\\Roaming\\DevFlowCLI\\devflow.db");
  });

  it("lanza si APPDATA no está definida", () => {
    expect(() => resolveDatabasePath({})).toThrow("APPDATA");
  });
});
