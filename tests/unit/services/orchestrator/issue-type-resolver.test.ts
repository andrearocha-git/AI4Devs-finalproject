import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveIssueType } from "../../../../src/services/orchestrator/issue-type-resolver.js";

const fixturesDir = new URL("../../../fixtures/tickets/", import.meta.url);
const templatePath = new URL("../../../../templates/issue-types.json", import.meta.url);

interface JiraFixture {
  key: string;
  fields: { summary: string; description: string | null; issuetype: { name: string } };
}

function loadFixture(name: string): JiraFixture {
  return JSON.parse(readFileSync(new URL(name, fixturesDir), "utf8")) as JiraFixture;
}

const template = JSON.parse(readFileSync(fileURLToPath(templatePath), "utf8")) as {
  types: Record<"bug" | "historia", { branchType: string; promptVersion: string }>;
};

describe("E1 — resolutor de tipo de issue (TK-02a CA2, fixtures)", () => {
  it.each([
    ["bug-completo.json", "bug"],
    ["bug-escueto.json", "bug"],
    ["historia-completa.json", "historia"],
    ["historia-escueta.json", "historia"],
  ] as const)("fixture %s se resuelve como %s con los datos de la plantilla", (file, tipo) => {
    const result = resolveIssueType(loadFixture(file).fields.issuetype.name);
    expect(result).toEqual({
      kind: "Ok",
      value: {
        tipo,
        branchType: template.types[tipo].branchType,
        promptVersion: template.types[tipo].promptVersion,
      },
    });
  });

  it("la épica queda bloqueada con TipoIssueBloqueado", () => {
    const result = resolveIssueType(loadFixture("epica.json").fields.issuetype.name);
    expect(result.kind).toBe("ErrorBloqueante");
    if (result.kind === "ErrorBloqueante") {
      expect(result.subtype).toBe("TipoIssueBloqueado");
      expect(result.message).not.toBe("");
    }
  });

  it.each(["Epic", "Épica", "epica", "  EPIC  "])("%s se trata como épica", (name) => {
    expect(resolveIssueType(name)).toMatchObject({ kind: "ErrorBloqueante", subtype: "TipoIssueBloqueado" });
  });

  it.each(["Bug", "Error", "Defecto", "bug", "ERROR", " Defecto "])("%s se trata como bug", (name) => {
    expect(resolveIssueType(name)).toMatchObject({ kind: "Ok", value: { tipo: "bug", branchType: "bugfix" } });
  });

  it.each(["Story", "Historia", "Tarea", "Task", "Sub-task", "Subtarea", "Algo Nuevo"])(
    "%s se trata como historia",
    (name) => {
      expect(resolveIssueType(name)).toMatchObject({ kind: "Ok", value: { tipo: "historia", branchType: "feature" } });
    },
  );
});
