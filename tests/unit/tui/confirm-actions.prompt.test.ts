import { describe, expect, it } from "vitest";
import type { ConfirmSummary } from "../../../src/shared/types/ticket-run.types.js";
import { confirmQuestion, formatConfirmSummary } from "../../../src/tui/prompts/confirm-actions.prompt.js";

const SUMMARY: ConfirmSummary = {
  ticketId: "SCRUM-12",
  issueType: "Story",
  repositoryName: "api",
  branchName: "features/SCRUM-12-AROCHA",
  baseBranch: "main",
  folderPath: "C:\\Tickets\\SCRUM-12\\api",
  branchAlreadyExists: false,
  reprocessFase1: false,
};

describe("TK-03b2 · E3 — formatConfirmSummary y confirmQuestion", () => {
  it("muestra en una sola pantalla el ticket, el tipo, el repositorio, la rama, la base y la carpeta", () => {
    const text = formatConfirmSummary(SUMMARY).join("\n");

    for (const expected of ["SCRUM-12", "Story", "api", "features/SCRUM-12-AROCHA", "main", "C:\\Tickets\\SCRUM-12\\api"]) {
      expect(text).toContain(expected);
    }
    expect(text).not.toMatch(/ya existe/i);
    expect(text).not.toMatch(/reproces|vuelve a generar|volverá a generar/i);
  });

  it("con la rama ya existente añade el aviso y la pregunta es si se usa la misma, con «no» por defecto", () => {
    const summary = { ...SUMMARY, branchAlreadyExists: true };

    expect(formatConfirmSummary(summary).join("\n")).toMatch(/ya existe/i);
    expect(confirmQuestion(summary)).toMatchObject({ message: expect.stringMatching(/misma/i), defaultValue: false });
  });

  it("sin rama existente la pregunta es continuar, con «sí» por defecto", () => {
    expect(confirmQuestion(SUMMARY)).toMatchObject({ message: expect.stringMatching(/continuar/i), defaultValue: true });
  });

  it("con reprocessFase1 indica que se volverá a generar el análisis de Ollama", () => {
    const text = formatConfirmSummary({ ...SUMMARY, reprocessFase1: true }).join("\n");

    expect(text).toMatch(/vuelve a generar|volverá a generar|reproces/i);
  });

  it("sin repositorio no muestra rama ni base y aclara que solo se genera el documento", () => {
    const summary: ConfirmSummary = { ...SUMMARY, repositoryName: null, branchName: null, baseBranch: null };

    const text = formatConfirmSummary(summary).join("\n");

    expect(text).toMatch(/solo se generará el documento/i);
    expect(text).not.toMatch(/rama/i);
    expect(text).not.toMatch(/base/i);
    expect(text).toContain("C:\\Tickets\\SCRUM-12\\api");
  });

  it.each(["", "   "])("con un ticket cargado a mano sin tipo (%j) no deja unos paréntesis vacíos", (issueType) => {
    const [ticketLine] = formatConfirmSummary({ ...SUMMARY, issueType });

    expect(ticketLine).toBe("Ticket: SCRUM-12");
  });
});

