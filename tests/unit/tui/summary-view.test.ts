import { describe, expect, it } from "vitest";
import type { TicketRunSummary } from "../../../src/shared/types/ticket-run.types.js";
import { createSummaryView, formatSummary } from "../../../src/tui/views/summary-view.js";

const OK: TicketRunSummary = {
  ticketId: "SCRUM-12",
  repositoryId: 10,
  issueType: "Story",
  branchName: "features/SCRUM-12-AROCHA",
  branchStatus: "created",
  folderPath: "C:\\Tickets\\SCRUM-12\\api",
  documentPath: "C:\\Tickets\\SCRUM-12\\api\\SCRUM-12.md",
  jiraFetchStatus: "ok",
  ollamaStatus: "ok",
  promptVersion: "historia-v1",
};

const text = (summary: TicketRunSummary) => formatSummary(summary).join("\n");

describe("TK-03b3 · E2 — pantalla de resumen: éxito y avisos", () => {
  it("el éxito dice que el ticket está listo y muestra el ID, el tipo, la rama, la carpeta y el documento, sin avisos ni bloqueos", () => {
    const lines = formatSummary(OK);

    expect(lines[0]).toBe("✔ Ticket SCRUM-12 (Story) listo para trabajar");
    for (const expected of ["features/SCRUM-12-AROCHA", "C:\\Tickets\\SCRUM-12\\api", "C:\\Tickets\\SCRUM-12\\api\\SCRUM-12.md"]) {
      expect(lines.join("\n")).toContain(expected);
    }
    expect(lines.join("\n")).not.toMatch(/⚠️|reutiliz|a mano|cancelada|⛔/);
  });

  it("con Ollama en fallback añade el aviso «⚠️ Generado sin Ollama» y qué hacer", () => {
    const lines = formatSummary({ ...OK, ollamaStatus: "fallback_deterministic" });

    expect(lines.join("\n")).toContain("⚠️ Generado sin Ollama");
    expect(lines[0]).toContain("listo para trabajar");
  });

  it("con el análisis reutilizado lo indica", () => {
    const result = text({ ...OK, ollamaStatus: "reused" });

    expect(result).toMatch(/se reutiliz[óo] el análisis del ticket/i);
    expect(result).not.toContain("⚠️");
  });

  it("con los datos cargados a mano lo indica", () => {
    expect(text({ ...OK, jiraFetchStatus: "fallback_manual" })).toMatch(/cargados a mano/i);
  });

  it("si la rama ya existía, lo indica junto a la rama", () => {
    expect(text({ ...OK, branchStatus: "already_existed" })).toMatch(/features\/SCRUM-12-AROCHA.*ya exist[ií]a/i);
  });

  it("sin repositorio aclara que solo se generó el documento y no hay línea de rama", () => {
    const result = text({ ...OK, repositoryId: null, branchName: null, branchStatus: null });

    expect(result).toMatch(/solo se generó el documento/i);
    expect(result).not.toMatch(/rama/i);
    expect(result).toContain("C:\\Tickets\\SCRUM-12\\api\\SCRUM-12.md");
  });

  it.each(["", "   "])("un ticket sin tipo (%j) muestra solo el ID, sin paréntesis vacíos", (issueType) => {
    expect(formatSummary({ ...OK, issueType })[0]).toBe("✔ Ticket SCRUM-12 listo para trabajar");
  });

  it("la cancelación escribe únicamente «Ejecución cancelada: no se creó nada.» y no una pantalla de éxito", () => {
    const lines = formatSummary({ ...OK, cancelled: true, branchName: null, folderPath: null, documentPath: null, ollamaStatus: null });

    expect(lines).toEqual(["Ejecución cancelada: no se creó nada."]);
  });

  it("el éxito, el fallback manual y el fallback de Ollama se distinguen entre sí", () => {
    const screens = [text(OK), text({ ...OK, jiraFetchStatus: "fallback_manual" }), text({ ...OK, ollamaStatus: "fallback_deterministic" })];

    expect(new Set(screens).size).toBe(3);
  });

  it("render escribe cada línea por out, en orden", () => {
    const written: string[] = [];

    createSummaryView((line) => written.push(line)).render(OK);

    expect(written).toEqual(formatSummary(OK));
  });
});

describe("TK-03b3 · E3 — pantallas de bloqueo", () => {
  const blockedOf = (subtype: string, message: string): TicketRunSummary => ({
    ticketId: "SCRUM-12",
    repositoryId: 10,
    issueType: "Story",
    branchName: null,
    branchStatus: null,
    folderPath: null,
    documentPath: null,
    jiraFetchStatus: "ok",
    ollamaStatus: null,
    blocked: { subtype, message },
  });

  const CASES = [
    { subtype: "RepositorioNoEncontrado", heading: /repositorio no encontrado/i, message: "La ruta C:\\work\\api ya no es un repositorio Git." },
    { subtype: "CambiosPendientes", heading: /cambios pendientes/i, message: "El repositorio api tiene cambios sin guardar:\n M src/a.ts\n?? notas.txt" },
    { subtype: "RamaExistenteEnRemoto", heading: /solo existe en origin/i, message: "La rama features/SCRUM-12-AROCHA solo existe en origin." },
    { subtype: "PullFallido", heading: /no se pudo actualizar la rama base/i, message: "git pull falló: sin conexión con origin." },
    { subtype: "TipoIssueBloqueado", heading: /tipo de ticket sin plantilla/i, message: "Los tickets de tipo «Epic» no tienen plantilla: elige una historia, tarea o bug." },
  ];

  it.each(CASES)("$subtype: encabezado propio del tipo seguido del mensaje del Orquestador, sin pantalla de éxito", ({ subtype, heading, message }) => {
    const lines = formatSummary(blockedOf(subtype, message));

    expect(lines[0]).toMatch(heading);
    expect(lines[0]).toMatch(/^⛔/);
    expect(lines.join("\n")).toContain(message);
    expect(lines.join("\n")).not.toMatch(/✔|listo para trabajar|Generado sin Ollama/);
  });

  it("cambios pendientes conserva la lista de archivos tal cual", () => {
    const message = "El repositorio api tiene cambios sin guardar:\n M src/a.ts\n?? notas.txt";

    const result = formatSummary(blockedOf("CambiosPendientes", message)).join("\n");

    expect(result).toContain(" M src/a.ts");
    expect(result).toContain("?? notas.txt");
  });

  it("los cinco bloqueos tienen encabezados distintos y un error inesperado tiene el suyo genérico", () => {
    const headings = CASES.map(({ subtype, message }) => formatSummary(blockedOf(subtype, message))[0]);
    const generic = formatSummary(blockedOf("ErrorInesperado", "Jira respondió algo raro"));

    expect(new Set(headings).size).toBe(5);
    expect(headings).not.toContain(generic[0]);
    expect(generic[0]).toMatch(/^⛔ No se pudo continuar/);
    expect(generic.join("\n")).toContain("Jira respondió algo raro");
  });

  it("un bloqueo se distingue del éxito, del fallback manual y del fallback de Ollama", () => {
    const screens = [
      text(OK),
      text({ ...OK, jiraFetchStatus: "fallback_manual" }),
      text({ ...OK, ollamaStatus: "fallback_deterministic" }),
      text(blockedOf("CambiosPendientes", "El repositorio api tiene cambios sin guardar:\n M a.ts")),
    ];

    expect(new Set(screens).size).toBe(4);
  });
});
