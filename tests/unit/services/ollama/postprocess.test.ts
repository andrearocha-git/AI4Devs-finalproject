import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import { postprocess, NO_ESPECIFICADO, type ModelDocument } from "../../../../src/services/ollama/postprocess.js";
import { postprocessRulesFor } from "../../../../src/services/orchestrator/issue-type-resolver.js";
import type { ContextoTicket } from "../../../../src/shared/types/ticket-context.types.js";

const schemaOf = (tipo: "bug" | "historia"): object =>
  JSON.parse(readFileSync(new URL(`../../../../templates/prompts/${tipo}.schema.json`, import.meta.url), "utf8"));
const validatorOf = (tipo: "bug" | "historia") => new Ajv({ strict: true }).compile(schemaOf(tipo));

/** Convierte un fixture de Jira (`tests/fixtures/tickets`) en el contexto que recibe el transformer. */
function fromFixture(name: string): ContextoTicket {
  const raw = JSON.parse(readFileSync(new URL(`../../../fixtures/tickets/${name}.json`, import.meta.url), "utf8")) as {
    key: string;
    fields: { summary: string; description: string | null; issuetype: { name: string } };
  };
  return {
    ticketId: raw.key,
    title: raw.fields.summary,
    description: raw.fields.description ?? "",
    issueType: raw.fields.issuetype.name,
    source: "jira",
  };
}

const ticket = (overrides: Partial<ContextoTicket> = {}): ContextoTicket => ({
  ticketId: "SCRUM-12",
  title: "El login falla con usuarios que tienen tilde en el apellido",
  description:
    "Pasos para reproducir:\n1. Abrir la pantalla de login.\n2. Ingresar el usuario 'Peña' y una clave válida.\n\nResultado actual: error 500.\nResultado esperado: acceso concedido.\n\nEntorno: Windows 11, Node 22.",
  issueType: "Bug",
  source: "jira",
  ...overrides,
});

const ESC = { titulo: "Login con tilde", given: "un usuario 'Peña'", when: "inicia sesión", then: "accede" };

function bug(overrides: Record<string, unknown> = {}): ModelDocument {
  return {
    presenteEnTicket: { pasosParaReproducir: true, comportamientoEsperado: true, comportamientoActual: true, entorno: true, escenarios: true },
    resumen: "El login falla con tildes.",
    pasosParaReproducir: ["Abrir la pantalla de login.", "Ingresar el usuario 'Peña'."],
    comportamientoEsperado: "Acceso concedido.",
    comportamientoActual: "Error 500.",
    entorno: "Windows 11, Node 22.",
    escenarios: [ESC],
    preguntasAbiertas: [],
    ...overrides,
  } as ModelDocument;
}

function historia(overrides: Record<string, unknown> = {}): ModelDocument {
  return {
    presenteEnTicket: { historiaUsuario: true, casosDeUso: true, escenarios: true },
    resumen: "Exportar el informe.",
    historiaUsuario: { como: "analista", quiero: "exportar el informe", para: "compartirlo" },
    casosDeUso: ["Exportar con filtros."],
    escenarios: [ESC],
    preguntasAbiertas: [],
    ...overrides,
  } as ModelDocument;
}

const BUG_RULES = postprocessRulesFor("bug");
const HISTORIA_RULES = postprocessRulesFor("historia");

describe("reglas de issue-types.json", () => {
  it.each(["bug", "historia"] as const)("las reglas siFalta de %s coinciden con los campos de presenteEnTicket de su schema", (tipo) => {
    const schema = schemaOf(tipo) as { properties: { presenteEnTicket: { properties: Record<string, unknown> } } };

    expect(Object.keys(postprocessRulesFor(tipo).siFalta).sort()).toEqual(Object.keys(schema.properties.presenteEnTicket.properties).sort());
  });

  it("solo los bugs verifican literales, y solo campos que existen en su schema", () => {
    const schema = schemaOf("bug") as { properties: Record<string, unknown> };

    expect(HISTORIA_RULES.verificarLiterales ?? []).toEqual([]);
    expect(BUG_RULES.verificarLiterales?.length).toBeGreaterThan(0);
    for (const field of BUG_RULES.verificarLiterales ?? []) expect(Object.keys(schema.properties)).toContain(field);
  });
});

describe("E3 — siFalta", () => {
  it("un campo de texto marcado como ausente queda en «No especificado en el ticket.» y se agrega su pregunta abierta", () => {
    const doc = bug({ presenteEnTicket: { ...bug().presenteEnTicket, entorno: false }, entorno: "Linux, Node 20" });

    const result = postprocess(doc, ticket(), BUG_RULES);

    expect(result.entorno).toBe(NO_ESPECIFICADO);
    expect(result.preguntasAbiertas).toEqual([BUG_RULES.siFalta.entorno]);
  });

  it("un campo de lista de textos ausente queda como [«No especificado en el ticket.»]", () => {
    const doc = bug({ presenteEnTicket: { ...bug().presenteEnTicket, pasosParaReproducir: false }, pasosParaReproducir: ["Inventado"] });

    const result = postprocess(doc, ticket(), BUG_RULES);

    expect(result.pasosParaReproducir).toEqual([NO_ESPECIFICADO]);
    expect(result.preguntasAbiertas).toContain(BUG_RULES.siFalta.pasosParaReproducir);
  });

  it("los escenarios ausentes quedan vacíos (la pregunta abierta explica la falta)", () => {
    const doc = bug({ presenteEnTicket: { ...bug().presenteEnTicket, escenarios: false } });

    const result = postprocess(doc, ticket(), BUG_RULES);

    expect(result.escenarios).toEqual([]);
    expect(result.preguntasAbiertas).toContain(BUG_RULES.siFalta.escenarios);
  });

  it("una historia de usuario ausente deja «No especificado en el ticket.» en cada parte", () => {
    const doc = historia({ presenteEnTicket: { ...historia().presenteEnTicket, historiaUsuario: false } });

    const result = postprocess(doc, ticket({ issueType: "Historia" }), HISTORIA_RULES);

    expect(result.historiaUsuario).toEqual({ como: NO_ESPECIFICADO, quiero: NO_ESPECIFICADO, para: NO_ESPECIFICADO });
    expect(result.preguntasAbiertas).toContain(HISTORIA_RULES.siFalta.historiaUsuario);
  });

  it("no repite una pregunta que el modelo ya hizo", () => {
    const doc = bug({
      presenteEnTicket: { ...bug().presenteEnTicket, entorno: false },
      preguntasAbiertas: [BUG_RULES.siFalta.entorno, "¿Otra duda?"],
    });

    const result = postprocess(doc, ticket(), BUG_RULES);

    expect(result.preguntasAbiertas).toEqual([BUG_RULES.siFalta.entorno, "¿Otra duda?"]);
  });

  it("agrega las preguntas de varios campos ausentes, una por campo, detrás de las que ya había", () => {
    const doc = bug({
      presenteEnTicket: { ...bug().presenteEnTicket, entorno: false, comportamientoEsperado: false },
      preguntasAbiertas: ["¿Antes funcionaba?"],
    });

    const result = postprocess(doc, ticket(), BUG_RULES);

    expect(result.preguntasAbiertas).toEqual(["¿Antes funcionaba?", BUG_RULES.siFalta.comportamientoEsperado, BUG_RULES.siFalta.entorno]);
  });

  it("no toca los campos presentes ni un campo que presenteEnTicket no menciona", () => {
    const doc = bug({ presenteEnTicket: { entorno: true } });

    expect(postprocess(doc, ticket(), BUG_RULES)).toEqual(doc);
  });

  it("no modifica el documento de entrada", () => {
    const doc = bug({ presenteEnTicket: { ...bug().presenteEnTicket, entorno: false } });
    const copy = structuredClone(doc);

    postprocess(doc, ticket(), BUG_RULES);

    expect(doc).toEqual(copy);
  });

  it("un bug escueto (sin descripción) con todo ausente queda sin datos inventados, con una pregunta por campo, y sigue cumpliendo el schema", () => {
    const escueto = fromFixture("bug-escueto");
    const doc = bug({
      presenteEnTicket: { pasosParaReproducir: false, comportamientoEsperado: false, comportamientoActual: false, entorno: false, escenarios: false },
      pasosParaReproducir: ["Abrir el menú Informes.", "Pulsar Exportar."],
      comportamientoEsperado: "Se descarga un PDF.",
      comportamientoActual: "No pasa nada.",
      entorno: "Chrome 120",
    });

    const result = postprocess(doc, escueto, BUG_RULES);

    expect(result).toMatchObject({
      pasosParaReproducir: [NO_ESPECIFICADO],
      comportamientoEsperado: NO_ESPECIFICADO,
      comportamientoActual: NO_ESPECIFICADO,
      entorno: NO_ESPECIFICADO,
      escenarios: [],
    });
    expect(result.preguntasAbiertas).toHaveLength(5);
    expect(validatorOf("bug")(result)).toBe(true);
  });

  it("una historia escueta con todo ausente queda sin datos inventados y cumple el schema", () => {
    const escueta = fromFixture("historia-escueta");
    const doc = historia({ presenteEnTicket: { historiaUsuario: false, casosDeUso: false, escenarios: false } });

    const result = postprocess(doc, escueta, HISTORIA_RULES);

    expect(result).toMatchObject({ casosDeUso: [NO_ESPECIFICADO], escenarios: [] });
    expect(result.historiaUsuario).toEqual({ como: NO_ESPECIFICADO, quiero: NO_ESPECIFICADO, para: NO_ESPECIFICADO });
    expect(validatorOf("historia")(result)).toBe(true);
  });

  it("un ticket completo con todo presente y fiel al ticket no cambia", () => {
    const completo = fromFixture("bug-completo");
    const doc = bug();

    expect(postprocess(doc, completo, BUG_RULES)).toEqual(doc);
  });
});

describe("E3 — verificarLiterales (solo bugs)", () => {
  it("descarta el paso que trae un número que no está en el ticket y conserva los demás", () => {
    const doc = bug({ pasosParaReproducir: ["Abrir la pantalla de login.", "Repetir 7 veces.", "Ingresar el usuario 'Peña'."] });

    const result = postprocess(doc, ticket(), BUG_RULES);

    expect(result.pasosParaReproducir).toEqual(["Abrir la pantalla de login.", "Ingresar el usuario 'Peña'."]);
  });

  it("conserva los literales que sí están en el ticket: números, versiones y textos entre comillas, sin distinguir mayúsculas", () => {
    const doc = bug({
      comportamientoActual: "Error 500 con el usuario 'peña'.",
      entorno: "Windows 11, Node 22.",
      pasosParaReproducir: ['Ingresar el usuario "PEÑA" y una clave válida.'],
    });

    const result = postprocess(doc, ticket(), BUG_RULES);

    expect(result).toEqual(doc);
  });

  it("un número no coincide con otro que lo contiene: «3» no está en «30»", () => {
    const doc = bug({ pasosParaReproducir: ["Esperar 3 segundos."] });

    const result = postprocess(doc, ticket({ description: "Esperar 30 segundos y reintentar." }), BUG_RULES);

    expect(result.pasosParaReproducir).toEqual([NO_ESPECIFICADO]);
  });

  it.each(["«Aceptar»", "“Aceptar”", '"Aceptar"', "'Aceptar'"])("descarta un texto entre comillas %s que el ticket no tiene", (quoted) => {
    const doc = bug({ comportamientoActual: `El botón ${quoted} desaparece.` });

    const result = postprocess(doc, ticket(), BUG_RULES);

    expect(result.comportamientoActual).toBe(NO_ESPECIFICADO);
  });

  it("un campo de texto con un literal inventado pasa a ausente: «No especificado», su pregunta abierta y presenteEnTicket en false", () => {
    const doc = bug({ comportamientoActual: "Falla con el código ERR-9921." });

    const result = postprocess(doc, ticket(), BUG_RULES);

    expect(result.comportamientoActual).toBe(NO_ESPECIFICADO);
    expect(result.preguntasAbiertas).toContain(BUG_RULES.siFalta.comportamientoActual);
    expect(result.presenteEnTicket?.comportamientoActual).toBe(false);
  });

  it("descarta el escenario completo si alguna de sus partes trae un literal inventado", () => {
    const doc = bug({ escenarios: [ESC, { titulo: "Reintento", given: "un fallo", when: "reintenta 5 veces", then: "funciona" }] });

    const result = postprocess(doc, ticket(), BUG_RULES);

    expect(result.escenarios).toEqual([ESC]);
  });

  it("si se descartan todos los elementos de una lista, el campo pasa a ausente", () => {
    const doc = bug({ pasosParaReproducir: ["Repetir 7 veces.", "Pulsar 'Enviar'."] });

    const result = postprocess(doc, ticket(), BUG_RULES);

    expect(result.pasosParaReproducir).toEqual([NO_ESPECIFICADO]);
    expect(result.preguntasAbiertas).toContain(BUG_RULES.siFalta.pasosParaReproducir);
    expect(result.presenteEnTicket?.pasosParaReproducir).toBe(false);
  });

  it("si todos los escenarios se descartan, quedan vacíos y se pregunta por ellos", () => {
    const doc = bug({ escenarios: [{ ...ESC, then: "ve el mensaje 'Bienvenida'" }] });

    const result = postprocess(doc, ticket(), BUG_RULES);

    expect(result.escenarios).toEqual([]);
    expect(result.preguntasAbiertas).toContain(BUG_RULES.siFalta.escenarios);
  });

  it("compara decimales con coma o punto como el mismo número", () => {
    const doc = bug({ entorno: "Versión 2.5 de la API" });

    expect(postprocess(doc, ticket({ description: "Usa la versión 2,5 de la API" }), BUG_RULES).entorno).toBe("Versión 2.5 de la API");
    expect(postprocess(doc, ticket({ description: "Usa la versión 2,6 de la API" }), BUG_RULES).entorno).toBe(NO_ESPECIFICADO);
  });

  it("un apóstrofo dentro de una palabra no cuenta como comilla", () => {
    const doc = bug({ comportamientoActual: "Falla el módulo d'Or." });

    expect(postprocess(doc, ticket(), BUG_RULES).comportamientoActual).toBe("Falla el módulo d'Or.");
  });

  it("no verifica los campos fuera de la lista (resumen, preguntas abiertas)", () => {
    const doc = bug({ resumen: "Falla 99 veces.", preguntasAbiertas: ["¿Es el caso 77?"] });

    const result = postprocess(doc, ticket(), BUG_RULES);

    expect(result.resumen).toBe("Falla 99 veces.");
    expect(result.preguntasAbiertas).toEqual(["¿Es el caso 77?"]);
  });

  it("en una historia no se verifican literales", () => {
    const doc = historia({ casosDeUso: ["Exportar 12 filas."] });

    expect(postprocess(doc, ticket({ issueType: "Historia", description: "Exportar el informe." }), HISTORIA_RULES).casosDeUso).toEqual(["Exportar 12 filas."]);
  });

  it("el resultado vuelve a cumplir el schema del tipo", () => {
    const doc = bug({ pasosParaReproducir: ["Repetir 7 veces."], comportamientoActual: "Falla con ERR-9921.", escenarios: [{ ...ESC, then: "ve 'Hola'" }] });

    expect(validatorOf("bug")(postprocess(doc, ticket(), BUG_RULES))).toBe(true);
  });
});
