import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { postprocessRulesFor, promptVersionFor } from "../../../../src/services/orchestrator/issue-type-resolver.js";
import { NO_ESPECIFICADO, postprocess, type ModelDocument } from "../../../../src/services/ollama/postprocess.js";
import type { ContextoTicket } from "../../../../src/shared/types/ticket-context.types.js";

// GH-44 · E2 y E3 — el posprocesado de la Fase 1 de una historia no pierde lo que el ticket sí dice.

interface JiraFixture {
  key: string;
  fields: { summary: string; description: string; issuetype: { name: string } };
}

const issue = JSON.parse(
  readFileSync(new URL("../../../fixtures/tickets/historia-wiki.json", import.meta.url), "utf8"),
) as JiraFixture;

/** El ticket de ejemplo, con el wiki real de Jira. */
const WIKI_TICKET: ContextoTicket = {
  ticketId: issue.key,
  title: issue.fields.summary,
  description: issue.fields.description,
  issueType: issue.fields.issuetype.name,
  source: "jira",
};

/** Un ticket de historia sin historia de usuario ni criterios. */
const PLAIN_TICKET: ContextoTicket = {
  ticketId: "SCRUM-40",
  title: "Mejorar el rendimiento de la lista",
  description: "La lista tarda en cargar cuando hay muchos elementos.",
  issueType: "Historia",
  source: "jira",
};

const PREGUNTA_HISTORIA = "¿Quién necesita esto, qué quiere y para qué?";
const RULES = postprocessRulesFor("historia");

/** Lo que devolvió el modelo, ya validado contra el schema. */
function modelDocument(overrides: Partial<ModelDocument> = {}): ModelDocument {
  return {
    presenteEnTicket: { historiaUsuario: true, casosDeUso: false, escenarios: false },
    resumen: "Registro de nuevos usuarios.",
    historiaUsuario: { como: "", quiero: "", para: "" },
    casosDeUso: [],
    escenarios: [],
    preguntasAbiertas: [],
    ...overrides,
  };
}

describe("GH-44 · E2 — la historia de usuario completa no se pierde", () => {
  it("conserva `quiero` y `para` del modelo y recupera `como` del texto del ticket, aunque el modelo marcó la historia como ausente", () => {
    const result = postprocess(
      modelDocument({
        presenteEnTicket: { historiaUsuario: false, casosDeUso: false, escenarios: false },
        historiaUsuario: { como: "", quiero: "registrarme con mi correo y una contraseña", para: "poder acceder a la aplicación" },
      }),
      WIKI_TICKET,
      RULES,
    );
    expect(result.historiaUsuario).toEqual({
      como: "nuevo usuario",
      quiero: "registrarme con mi correo y una contraseña",
      para: "poder acceder a la aplicación",
    });
  });

  it("marca la historia como presente y no agrega la pregunta abierta de la historia", () => {
    const result = postprocess(
      modelDocument({
        presenteEnTicket: { historiaUsuario: false, casosDeUso: false, escenarios: false },
        historiaUsuario: { como: "", quiero: "registrarme", para: "acceder" },
      }),
      WIKI_TICKET,
      RULES,
    );
    expect(result.presenteEnTicket?.historiaUsuario).toBe(true);
    expect(result.preguntasAbiertas).not.toContain(PREGUNTA_HISTORIA);
  });

  it("recupera las tres partes del ticket cuando el modelo las dejó vacías", () => {
    const result = postprocess(
      modelDocument({ presenteEnTicket: { historiaUsuario: false, casosDeUso: false, escenarios: false } }),
      WIKI_TICKET,
      RULES,
    );
    expect(result.historiaUsuario).toEqual({
      como: "nuevo usuario",
      quiero: "registrarme con mi correo y una contraseña",
      para: "poder acceder a la aplicación",
    });
  });

  it("no pisa con el texto del ticket lo que el modelo ya devolvió", () => {
    const result = postprocess(
      modelDocument({ historiaUsuario: { como: "visitante", quiero: "crear una cuenta", para: "entrar" } }),
      WIKI_TICKET,
      RULES,
    );
    expect(result.historiaUsuario).toEqual({ como: "visitante", quiero: "crear una cuenta", para: "entrar" });
  });

  it("si el ticket no trae la historia, sigue sobrescribiéndola con «No especificado» y agrega la pregunta", () => {
    const result = postprocess(
      modelDocument({ presenteEnTicket: { historiaUsuario: false, casosDeUso: false, escenarios: false } }),
      PLAIN_TICKET,
      RULES,
    );
    expect(result.historiaUsuario).toEqual({ como: NO_ESPECIFICADO, quiero: NO_ESPECIFICADO, para: NO_ESPECIFICADO });
    expect(result.presenteEnTicket?.historiaUsuario).toBe(false);
    expect(result.preguntasAbiertas).toContain(PREGUNTA_HISTORIA);
  });

  it("no acepta una historia inventada por el modelo cuando el ticket no la trae", () => {
    const result = postprocess(
      modelDocument({
        presenteEnTicket: { historiaUsuario: false, casosDeUso: false, escenarios: false },
        historiaUsuario: { como: "administrador", quiero: "ver estadísticas", para: "decidir" },
      }),
      PLAIN_TICKET,
      RULES,
    );
    expect(result.historiaUsuario).toEqual({ como: NO_ESPECIFICADO, quiero: NO_ESPECIFICADO, para: NO_ESPECIFICADO });
    expect(result.presenteEnTicket?.historiaUsuario).toBe(false);
  });
});

// ---- E3: los escenarios salen con Given / When / Then rellenos, o no salen ----

const PREGUNTA_ESCENARIOS = "¿Cuáles son los criterios de aceptación?";
const vacio = (titulo: string) => ({ titulo, given: "", when: "", then: "" });
/** Respuesta del modelo que da los escenarios por presentes en el ticket, como en el caso real de #44. */
const conEscenarios = (escenarios: ModelDocument["escenarios"]): ModelDocument =>
  modelDocument({ presenteEnTicket: { historiaUsuario: true, casosDeUso: false, escenarios: true }, escenarios });

const ESCENARIOS_DEL_TICKET = [
  {
    titulo: "Registro exitoso (Happy Path)",
    given: "estoy en la pantalla de registro",
    when: "ingreso un correo válido y una contraseña de 8 caracteres",
    then: "se crea mi cuenta y veo un mensaje de bienvenida",
  },
  {
    titulo: "Correo ya registrado",
    given: "ya existe una cuenta con mi correo",
    when: "intento registrarme con ese correo",
    then: 'veo el mensaje "El correo ya está registrado"',
  },
  {
    titulo: "Contraseña demasiado corta",
    given: "estoy en la pantalla de registro",
    when: "ingreso una contraseña de menos de 8 caracteres",
    then: "el sistema rechaza el registro y explica el motivo",
  },
];

describe("GH-44 · E3 — los escenarios salen con Given / When / Then rellenos, o no salen", () => {
  it("rellena Given / When / Then desde el texto del ticket cuando el modelo los dejó vacíos (por título)", () => {
    const result = postprocess(
      conEscenarios([vacio("Registro exitoso"), vacio("Correo ya registrado"), vacio("Contraseña demasiado corta")]),
      WIKI_TICKET,
      RULES,
    );
    expect(result.escenarios.map(({ given, when, then }) => ({ given, when, then }))).toEqual(
      ESCENARIOS_DEL_TICKET.map(({ given, when, then }) => ({ given, when, then })),
    );
    expect(result.escenarios.map((e) => e.titulo)).toEqual(["Registro exitoso", "Correo ya registrado", "Contraseña demasiado corta"]);
  });

  it("los empareja por posición cuando el modelo cambió los títulos pero devolvió el mismo número de escenarios", () => {
    const result = postprocess(
      conEscenarios([vacio("Escenario 1"), vacio("Escenario 2"), vacio("Escenario 3")]),
      WIKI_TICKET,
      RULES,
    );
    expect(result.escenarios.map((e) => e.then)).toEqual(ESCENARIOS_DEL_TICKET.map((e) => e.then));
  });

  it("completa solo lo que falta de un escenario y no pisa lo que el modelo devolvió", () => {
    const result = postprocess(
      conEscenarios([{ titulo: "Correo ya registrado", given: "una cuenta existente", when: "", then: "" }]),
      WIKI_TICKET,
      RULES,
    );
    expect(result.escenarios).toEqual([
      { titulo: "Correo ya registrado", given: "una cuenta existente", when: "intento registrarme con ese correo", then: 'veo el mensaje "El correo ya está registrado"' },
    ]);
  });

  it("deja intacto un escenario que el modelo devolvió completo", () => {
    const completo = { titulo: "Otro", given: "a", when: "b", then: "c" };
    const result = postprocess(conEscenarios([completo]), PLAIN_TICKET, RULES);
    expect(result.escenarios).toEqual([completo]);
  });

  it("descarta un escenario vacío que no se puede recuperar y conserva los demás", () => {
    const result = postprocess(
      conEscenarios([vacio("Registro exitoso"), vacio("Algo que el ticket no dice"), vacio("Correo ya registrado"), vacio("Contraseña demasiado corta")]),
      WIKI_TICKET,
      RULES,
    );
    expect(result.escenarios.map((e) => e.titulo)).toEqual(["Registro exitoso", "Correo ya registrado", "Contraseña demasiado corta"]);
  });

  it("si no queda ningún escenario, marca `escenarios` como ausente, lo deja vacío y agrega su pregunta abierta", () => {
    const result = postprocess(
      modelDocument({
        presenteEnTicket: { historiaUsuario: false, casosDeUso: false, escenarios: true },
        escenarios: [vacio("Uno"), vacio("Dos")],
      }),
      PLAIN_TICKET,
      RULES,
    );
    expect(result.escenarios).toEqual([]);
    expect(result.presenteEnTicket?.escenarios).toBe(false);
    expect(result.preguntasAbiertas).toContain(PREGUNTA_ESCENARIOS);
  });
});

describe("GH-44 · E3 — el prompt de historia explica las equivalencias en español", () => {
  const prompt = readFileSync(new URL("../../../../templates/prompts/historia.system.md", import.meta.url), "utf8");

  it("dice que Dado / Cuando / Entonces equivalen a Given / When / Then", () => {
    for (const palabra of ["Dado", "Cuando", "Entonces", "Given", "When", "Then"]) expect(prompt, `falta «${palabra}»`).toContain(palabra);
  });

  it("dice que Como / Quiero / Para es la historia de usuario y que no se dejan vacíos given, when ni then", () => {
    expect(prompt).toMatch(/Como \/ Quiero \/ Para/i);
    expect(prompt).toMatch(/no (los )?dejes vac/i);
  });

  it("sube la versión del prompt de historia a historia-v2", () => {
    expect(promptVersionFor("historia")).toBe("historia-v2");
  });
});
