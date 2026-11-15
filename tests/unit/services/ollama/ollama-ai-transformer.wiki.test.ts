import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OllamaAITransformer } from "../../../../src/services/ollama/ollama-ai-transformer.js";
import type { ContextoTicket } from "../../../../src/shared/types/ticket-context.types.js";

// GH-44 · E1 — la descripción en formato wiki llega limpia a Ollama; el original y el fallback no cambian.

interface JiraFixture {
  key: string;
  fields: { summary: string; description: string; issuetype: { name: string } };
}

const issue = JSON.parse(
  readFileSync(new URL("../../../fixtures/tickets/historia-wiki.json", import.meta.url), "utf8"),
) as JiraFixture;

const ticket: ContextoTicket = {
  ticketId: issue.key,
  title: issue.fields.summary,
  description: issue.fields.description,
  issueType: issue.fields.issuetype.name,
  source: "jira",
};

const MODEL_OUTPUT = JSON.stringify({
  presenteEnTicket: { historiaUsuario: true, casosDeUso: false, escenarios: true },
  resumen: "Registro de nuevos usuarios.",
  historiaUsuario: { como: "nuevo usuario", quiero: "registrarme", para: "acceder" },
  casosDeUso: [],
  escenarios: [{ titulo: "Registro exitoso", given: "en el registro", when: "ingreso mis datos", then: "se crea la cuenta" }],
  preguntasAbiertas: [],
});

/** `fetch` falso que guarda el cuerpo de la petición y responde con la salida del modelo en streaming. */
function fakeFetch(captured: Array<Record<string, unknown>>): typeof fetch {
  return (async (_input: unknown, init?: { body?: unknown }) => {
    captured.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const line = JSON.stringify({ model: "qwen2.5:3b", response: MODEL_OUTPUT, done: false });
    return new Response(`${line}\n${JSON.stringify({ response: "", done: true })}\n`, { status: 200 });
  }) as typeof fetch;
}

const options = { host: "http://ollama.test:11434", model: "qwen2.5:3b", timeoutSeconds: 5 };

describe("GH-44 · E1 — la petición a Ollama va sin marcas wiki", () => {
  it("el ticket de ejemplo tiene el formato wiki real (si no, la prueba no prueba nada)", () => {
    expect(ticket.description).toContain("*Como*");
    expect(ticket.description).toContain("h3. ");
    expect(ticket.description).toContain("**_Happy Path_**");
  });

  it("el prompt enviado no contiene marcas wiki", async () => {
    const captured: Array<Record<string, unknown>> = [];
    await new OllamaAITransformer({ ...options, fetch: fakeFetch(captured) }).processContext(ticket, "historia");
    const prompt = String(captured[0]?.prompt);
    expect(prompt).not.toMatch(/\*\S/);
    expect(prompt).not.toMatch(/\S\*/);
    expect(prompt).not.toMatch(/(^|\n)h[1-6]\.\s/);
    expect(prompt).not.toContain("_Happy Path_");
  });

  it("el prompt conserva la historia, los Dado / Cuando / Entonces y las viñetas como líneas con guion", async () => {
    const captured: Array<Record<string, unknown>> = [];
    await new OllamaAITransformer({ ...options, fetch: fakeFetch(captured) }).processContext(ticket, "historia");
    const prompt = String(captured[0]?.prompt);
    expect(prompt).toContain("Como nuevo usuario, quiero registrarme con mi correo y una contraseña, para poder acceder a la aplicación.");
    expect(prompt).toContain("1. Registro exitoso (Happy Path)");
    expect(prompt).toContain("- Dado que estoy en la pantalla de registro");
    expect(prompt).toContain("- Cuando ingreso un correo válido y una contraseña de 8 caracteres");
    expect(prompt).toContain('- Entonces veo el mensaje "El correo ya está registrado"');
  });

  it("la descripción original del ticket no se modifica y el texto crudo del fallback conserva el wiki", async () => {
    const original = ticket.description;
    const failing = (async () => {
      throw new Error("Ollama apagado");
    }) as unknown as typeof fetch;
    const result = await new OllamaAITransformer({ ...options, fetch: failing }).processContext(ticket, "historia");
    expect(ticket.description).toBe(original);
    expect(result.kind).toBe("FallbackDeterminista");
    if (result.kind === "FallbackDeterminista") expect(result.rawText).toContain("*Como* nuevo usuario");
  });
});
