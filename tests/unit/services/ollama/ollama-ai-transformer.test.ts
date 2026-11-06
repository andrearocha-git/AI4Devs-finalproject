import { readFileSync } from "node:fs";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { OllamaAITransformer } from "../../../../src/services/ollama/ollama-ai-transformer.js";
import type { ContextoTicket } from "../../../../src/shared/types/ticket-context.types.js";

const HOST = "http://ollama.test:11434";
const MODEL = "qwen2.5:3b";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const template = (name: string): string => readFileSync(new URL(`../../../../templates/prompts/${name}`, import.meta.url), "utf8");
const schemaOf = (tipo: "bug" | "historia"): { properties: Record<string, unknown> } => JSON.parse(template(`${tipo}.schema.json`));

function ticket(overrides: Partial<ContextoTicket> = {}): ContextoTicket {
  return {
    ticketId: "SCRUM-12",
    title: "El login falla con usuarios que tienen tilde en el apellido",
    description: "Pasos para reproducir:\n1. Abrir la pantalla de login.\n2. Ingresar el usuario 'Peña'.\nResultado actual: error 500.\nResultado esperado: acceso concedido.\nEntorno: Windows 11, Node 22.",
    issueType: "Bug",
    source: "jira",
    ...overrides,
  };
}

const ESCENARIO = { titulo: "Login con tilde", given: "un usuario con tilde", when: "inicia sesión", then: "accede" };

function validBug() {
  return {
    presenteEnTicket: { pasosParaReproducir: true, comportamientoEsperado: true, comportamientoActual: true, entorno: true, escenarios: true },
    resumen: "El login falla con tildes.",
    pasosParaReproducir: ["Abrir la pantalla de login.", "Ingresar el usuario 'Peña'."],
    comportamientoEsperado: "Acceso concedido.",
    comportamientoActual: "Error 500.",
    entorno: "Windows 11, Node 22.",
    escenarios: [ESCENARIO],
    preguntasAbiertas: [],
  };
}

function validHistoria() {
  return {
    presenteEnTicket: { historiaUsuario: true, casosDeUso: true, escenarios: true },
    resumen: "Exportar el informe a PDF.",
    historiaUsuario: { como: "analista", quiero: "exportar el informe", para: "compartirlo" },
    casosDeUso: ["Exportar con filtros."],
    escenarios: [ESCENARIO],
    preguntasAbiertas: [],
  };
}

/** Formato de streaming de Ollama: un JSON por línea; `parts` son los trozos de `response` (el JSON del modelo partido). */
function ndjson(parts: string[], splitLineAt?: number): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = [
    ...parts.map((response) => JSON.stringify({ model: MODEL, response, done: false })),
    JSON.stringify({ model: MODEL, response: "", done: true }),
  ];
  const raw = lines.join("\n") + "\n";
  const chunks = splitLineAt === undefined ? [raw] : [raw.slice(0, splitLineAt), raw.slice(splitLineAt)];
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

/** Copia del objeto sin la clave indicada. */
function omit<T extends object>(value: T, key: keyof T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([k]) => k !== key)) as Partial<T>;
}

function split(text: string, pieces: number): string[] {
  const size = Math.ceil(text.length / pieces);
  return Array.from({ length: pieces }, (_, i) => text.slice(i * size, (i + 1) * size)).filter((p) => p !== "");
}

interface Served {
  requests: Array<{ url: URL; method: string; body: Record<string, unknown> }>;
}

/** Sirve `/api/generate` con la respuesta del modelo (texto JSON) en streaming y guarda las peticiones recibidas. */
function serve(modelOutput: string, options: { pieces?: number; splitLineAt?: number } = {}): Served {
  const served: Served = { requests: [] };
  server.use(
    http.post(`${HOST}/api/generate`, async ({ request }) => {
      served.requests.push({ url: new URL(request.url), method: request.method, body: (await request.json()) as Record<string, unknown> });
      return new HttpResponse(ndjson(split(modelOutput, options.pieces ?? 4), options.splitLineAt), {
        headers: { "Content-Type": "application/x-ndjson" },
      });
    }),
  );
  return served;
}

function newTransformer(overrides: Partial<ConstructorParameters<typeof OllamaAITransformer>[0]> = {}): OllamaAITransformer {
  return new OllamaAITransformer({ host: HOST, model: MODEL, timeoutSeconds: 5, keepAlive: "30s", ...overrides });
}

describe("E1 — respuesta válida de Ollama", () => {
  it.each([
    ["bug", validBug(), "bug-v1"],
    ["historia", validHistoria(), "historia-v1"],
  ] as const)("%s: devuelve Ok con el DocumentoFase1, generatedByOllama y la promptVersion del tipo", async (tipo, output, promptVersion) => {
    serve(JSON.stringify(output));

    const result = await newTransformer().processContext(ticket(), tipo);

    expect(result).toEqual({ kind: "Ok", value: { ...output, generatedByOllama: true, promptVersion } });
  });

  it("hace una sola petición POST /api/generate con modelo, keep_alive, stream y el schema del tipo en `format`", async () => {
    const served = serve(JSON.stringify(validBug()));

    await newTransformer({ keepAlive: "45s" }).processContext(ticket(), "bug");

    expect(served.requests).toHaveLength(1);
    const { url, method, body } = served.requests[0]!;
    expect(method).toBe("POST");
    expect(url.pathname).toBe("/api/generate");
    expect(body).toMatchObject({ model: MODEL, stream: true, keep_alive: "45s" });
    expect(body.format).toEqual(schemaOf("bug"));
    expect(Object.keys((body.format as { properties: object }).properties)[0]).toBe("presenteEnTicket");
  });

  it("cada tipo manda su propio schema, con presenteEnTicket como primer campo", async () => {
    const served = serve(JSON.stringify(validHistoria()));

    await newTransformer().processContext(ticket({ issueType: "Historia" }), "historia");

    const format = served.requests[0]!.body.format as { properties: Record<string, unknown> };
    expect(format).toEqual(schemaOf("historia"));
    expect(format).not.toEqual(schemaOf("bug"));
    expect(Object.keys(format.properties)[0]).toBe("presenteEnTicket");
  });

  it("arma `system` con el prompt común y el del tipo, y `prompt` con el ID, el título y la descripción", async () => {
    const served = serve(JSON.stringify(validBug()));

    await newTransformer().processContext(ticket(), "bug");

    const { system, prompt } = served.requests[0]!.body as { system: string; prompt: string };
    expect(system).toContain(template("comun.system.md").trim());
    expect(system).toContain(template("bug.system.md").trim());
    expect(system).not.toContain(template("historia.system.md").trim());
    expect(prompt).toContain("SCRUM-12");
    expect(prompt).toContain("El login falla con usuarios que tienen tilde en el apellido");
    expect(prompt).toContain("Ingresar el usuario 'Peña'.");
  });

  it("no vuelve a expandir marcadores que vengan dentro del texto del ticket", async () => {
    const served = serve(JSON.stringify(validBug()));

    await newTransformer().processContext(ticket({ title: "Usa {{description}} en el título", description: "texto {{ticketId}}" }), "bug");

    const prompt = (served.requests[0]!.body as { prompt: string }).prompt;
    expect(prompt).toContain("Usa {{description}} en el título");
    expect(prompt).toContain("texto {{ticketId}}");
  });

  it("indica que no hay descripción cuando el ticket la trae vacía", async () => {
    const served = serve(JSON.stringify(validBug()));

    await newTransformer().processContext(ticket({ description: "" }), "bug");

    expect((served.requests[0]!.body as { prompt: string }).prompt).toContain("(sin descripción)");
  });

  it("fija temperature 0 para respuestas repetibles", async () => {
    const served = serve(JSON.stringify(validBug()));

    await newTransformer().processContext(ticket(), "bug");

    expect(served.requests[0]!.body.options).toMatchObject({ temperature: 0 });
  });

  it("onToken recibe el total acumulado de caracteres, creciente, hasta el largo de la respuesta", async () => {
    const output = JSON.stringify(validBug());
    serve(output, { pieces: 5 });
    const onToken = vi.fn();

    await newTransformer().processContext(ticket(), "bug", onToken);

    const totals = onToken.mock.calls.map(([chars]) => chars as number);
    expect(totals.length).toBeGreaterThan(1);
    expect([...totals].sort((a, b) => a - b)).toEqual(totals);
    expect(new Set(totals).size).toBe(totals.length);
    expect(totals.at(-1)).toBe(output.length);
  });

  it("une la respuesta aunque una línea del streaming llegue partida en dos trozos de red", async () => {
    const output = JSON.stringify(validBug());
    serve(output, { pieces: 3, splitLineAt: 40 });

    const result = await newTransformer().processContext(ticket(), "bug");

    expect(result.kind).toBe("Ok");
  });

  it("funciona sin onToken", async () => {
    serve(JSON.stringify(validHistoria()));

    const result = await newTransformer().processContext(ticket(), "historia");

    expect(result.kind).toBe("Ok");
  });
});

describe("E2 — cualquier fallo cae a FallbackDeterminista", () => {
  const TICKET = ticket();
  const FALLBACK = { kind: "FallbackDeterminista", rawText: `${TICKET.title}\n\n${TICKET.description}` };

  const run = (tipo: "bug" | "historia" = "bug", ctx: ContextoTicket = TICKET) => newTransformer().processContext(ctx, tipo);

  /** Respuesta con el JSON del modelo modificado por `change`. */
  function served(change: (output: ReturnType<typeof validBug>) => unknown): void {
    serve(JSON.stringify(change(validBug())));
  }

  describe("la respuesta no cumple el schema", () => {
    it.each<[string, (o: ReturnType<typeof validBug>) => unknown]>([
      ["falta un campo obligatorio", (o) => omit(o, "entorno")],
      ["un campo con el tipo equivocado", (o) => ({ ...o, resumen: 42 })],
      ["un campo que el schema no admite", (o) => ({ ...o, extra: "x" })],
      ["falta presenteEnTicket", (o) => omit(o, "presenteEnTicket")],
      ["un escenario sin `then`", (o) => ({ ...o, escenarios: [{ titulo: "t", given: "g", when: "w" }] })],
      ["un valor de presenteEnTicket que no es booleano", (o) => ({ ...o, presenteEnTicket: { ...o.presenteEnTicket, entorno: "sí" } })],
      ["una lista en lugar de un objeto", () => []],
      ["null", () => null],
    ])("%s → fallback con el texto crudo", async (_name, change) => {
      served(change);

      expect(await run()).toEqual(FALLBACK);
    });

    it("una respuesta de historia con el schema de bug no pasa", async () => {
      serve(JSON.stringify(validHistoria()));

      expect(await run("bug")).toEqual(FALLBACK);
    });
  });

  describe("código fuente embebido (Non-Goal «cero código generado»)", () => {
    const fenced = "Así:\n```js\nconsole.log(1)\n```";

    it.each<[string, (o: ReturnType<typeof validBug>) => unknown]>([
      ["en un campo de texto", (o) => ({ ...o, resumen: fenced })],
      ["en un elemento de una lista", (o) => ({ ...o, pasosParaReproducir: ["Abrir login", fenced] })],
      ["en un escenario", (o) => ({ ...o, escenarios: [{ ...ESCENARIO, given: fenced }] })],
      ["en una pregunta abierta", (o) => ({ ...o, preguntasAbiertas: [fenced] })],
    ])("%s → fallback", async (_name, change) => {
      served(change);

      expect(await run()).toEqual(FALLBACK);
    });

    it("también en una historia", async () => {
      serve(JSON.stringify({ ...validHistoria(), casosDeUso: [fenced] }));

      expect(await run("historia")).toEqual(FALLBACK);
    });

    it("un fragmento en línea con un solo acento grave no cae a fallback", async () => {
      served((o) => ({ ...o, resumen: "Falla el botón `Aceptar` al guardar." }));

      expect((await run()).kind).toBe("Ok");
    });
  });

  describe("respuesta ilegible", () => {
    it.each([
      ["JSON mal formado", '{ "resumen": "cortado'],
      ["texto que no es JSON", "Lo siento, no puedo ayudar con eso."],
      ["respuesta vacía", ""],
    ])("%s → fallback", async (_name, output) => {
      serve(output, { pieces: 1 });

      expect(await run()).toEqual(FALLBACK);
    });

    it("un error en mitad del streaming → fallback", async () => {
      server.use(
        http.post(`${HOST}/api/generate`, () => {
          const encoder = new TextEncoder();
          const lines = [JSON.stringify({ response: '{ "resumen": "x', done: false }), JSON.stringify({ error: "model runner has unexpectedly stopped" })];
          return new HttpResponse(new ReadableStream({ start: (c) => { c.enqueue(encoder.encode(lines.join("\n") + "\n")); c.close(); } }));
        }),
      );

      expect(await run()).toEqual(FALLBACK);
    });
  });

  describe("Ollama no responde bien", () => {
    it.each([
      [404, "modelo no instalado"],
      [500, "error interno"],
      [503, "servicio no disponible"],
    ])("HTTP %i (%s) → fallback", async (status) => {
      server.use(http.post(`${HOST}/api/generate`, () => HttpResponse.json({ error: "model 'qwen2.5:3b' not found" }, { status })));

      expect(await run()).toEqual(FALLBACK);
    });

    it("conexión rechazada (Ollama apagado) → fallback", async () => {
      server.use(http.post(`${HOST}/api/generate`, () => HttpResponse.error()));

      expect(await run()).toEqual(FALLBACK);
    });

    it("una URL de Ollama inválida → fallback, sin lanzar", async () => {
      const result = await new OllamaAITransformer({ host: "no es una url", model: MODEL, timeoutSeconds: 5 }).processContext(TICKET, "bug");

      expect(result).toEqual(FALLBACK);
    });

    it("un cuerpo de respuesta ausente → fallback", async () => {
      const result = await newTransformer({ fetch: (async () => new Response(null, { status: 200 })) as typeof fetch }).processContext(TICKET, "bug");

      expect(result).toEqual(FALLBACK);
    });
  });

  describe("timeout total", () => {
    it("una respuesta que tarda más que el timeout → fallback, sin esperar a que termine", async () => {
      server.use(
        http.post(`${HOST}/api/generate`, async () => {
          await delay(1500);
          return new HttpResponse(ndjson([JSON.stringify(validBug())]));
        }),
      );
      const started = Date.now();

      const result = await newTransformer({ timeoutSeconds: 0.2 }).processContext(TICKET, "bug");

      expect(result).toEqual(FALLBACK);
      expect(Date.now() - started).toBeLessThan(1200);
    });

    it("un streaming que empieza pero no termina también vence por el timeout total", async () => {
      // `fetch` inyectado: devuelve un primer trozo y se queda esperando; se corta cuando se dispara el AbortSignal, como el `fetch` real.
      // (Con msw, el corte a mitad de respuesta provoca una aserción interna de undici ajena a este código.)
      const hangingFetch = (async (_url: unknown, init?: RequestInit) => {
        const encoder = new TextEncoder();
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(JSON.stringify({ response: '{ "resumen"', done: false }) + "\n"));
              init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason));
            },
          }),
        );
      }) as typeof fetch;
      const onToken = vi.fn();
      const started = Date.now();

      const result = await newTransformer({ timeoutSeconds: 0.3, fetch: hangingFetch }).processContext(TICKET, "bug", onToken);

      expect(result).toEqual(FALLBACK);
      expect(onToken).toHaveBeenCalled();
      expect(Date.now() - started).toBeLessThan(1500);
    });
  });

  describe("rawText", () => {
    it("es el título y la descripción originales, sin redactar", async () => {
      server.use(http.post(`${HOST}/api/generate`, () => HttpResponse.error()));

      const result = await run("bug", ticket({ title: "Título", description: "Línea 1\nLínea 2" }));

      expect(result).toEqual({ kind: "FallbackDeterminista", rawText: "Título\n\nLínea 1\nLínea 2" });
    });

    it("sin descripción es solo el título", async () => {
      server.use(http.post(`${HOST}/api/generate`, () => HttpResponse.error()));

      const result = await run("historia", ticket({ title: "Solo título", description: "  " }));

      expect(result).toEqual({ kind: "FallbackDeterminista", rawText: "Solo título" });
    });
  });
});

describe("E3 — el posprocesado se aplica al resultado de processContext", () => {
  it("un bug: sobrescribe lo ausente, descarta lo inventado y conserva lo fiel al ticket", async () => {
    serve(
      JSON.stringify({
        ...validBug(),
        presenteEnTicket: { ...validBug().presenteEnTicket, entorno: false },
        entorno: "Ubuntu 22.04",
        pasosParaReproducir: ["Abrir la pantalla de login.", "Repetir 9 veces.", "Ingresar el usuario 'Peña'."],
      }),
    );

    const result = await newTransformer().processContext(ticket(), "bug");

    expect(result.kind).toBe("Ok");
    if (result.kind !== "Ok") return;
    expect(result.value.entorno).toBe("No especificado en el ticket.");
    expect(result.value.pasosParaReproducir).toEqual(["Abrir la pantalla de login.", "Ingresar el usuario 'Peña'."]);
    expect(result.value.comportamientoActual).toBe("Error 500.");
    expect(result.value.preguntasAbiertas).toEqual(["¿En qué entorno ocurre (sistema, versión, navegador)?"]);
    expect(result.value).toMatchObject({ generatedByOllama: true, promptVersion: "bug-v1" });
  });

  it("una historia escueta con todo ausente queda sin datos inventados", async () => {
    serve(JSON.stringify({ ...validHistoria(), presenteEnTicket: { historiaUsuario: false, casosDeUso: false, escenarios: false } }));

    const result = await newTransformer().processContext(ticket({ title: "Exportar informe", description: "", issueType: "Historia" }), "historia");

    expect(result.kind).toBe("Ok");
    if (result.kind !== "Ok") return;
    expect(result.value.historiaUsuario).toEqual({
      como: "No especificado en el ticket.",
      quiero: "No especificado en el ticket.",
      para: "No especificado en el ticket.",
    });
    expect(result.value.casosDeUso).toEqual(["No especificado en el ticket."]);
    expect(result.value.escenarios).toEqual([]);
    expect(result.value.preguntasAbiertas).toHaveLength(3);
  });

  it("una historia no verifica literales: lo que dice el modelo con números se conserva", async () => {
    serve(JSON.stringify({ ...validHistoria(), casosDeUso: ["Exportar 12 filas."] }));

    const result = await newTransformer().processContext(ticket({ issueType: "Historia", description: "Exportar el informe." }), "historia");

    expect(result.kind === "Ok" && result.value.casosDeUso).toEqual(["Exportar 12 filas."]);
  });

  it("no posprocesa una respuesta inválida: cae a fallback antes", async () => {
    serve(JSON.stringify({ ...validBug(), resumen: 42 }));

    const result = await newTransformer().processContext(ticket(), "bug");

    expect(result.kind).toBe("FallbackDeterminista");
  });
});

describe("streaming: bordes del NDJSON", () => {
  /** Sirve los trozos de bytes tal cual, sin añadir saltos de línea ni líneas `done`. */
  function serveBytes(chunks: Uint8Array[]): void {
    server.use(
      http.post(`${HOST}/api/generate`, () =>
        new HttpResponse(new ReadableStream({ start: (c) => { for (const chunk of chunks) c.enqueue(chunk); c.close(); } })),
      ),
    );
  }
  const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

  it("procesa la última línea aunque no termine en salto de línea", async () => {
    const output = JSON.stringify(validBug());
    const half = Math.floor(output.length / 2);
    const lines = [JSON.stringify({ response: output.slice(0, half), done: false }), JSON.stringify({ response: output.slice(half), done: true })];
    serveBytes([encode(lines.join("\n"))]);
    const onToken = vi.fn();

    const result = await newTransformer().processContext(ticket(), "bug", onToken);

    expect(result.kind).toBe("Ok");
    expect(onToken.mock.calls.at(-1)?.[0]).toBe(output.length);
  });

  it("procesa una única línea sin salto de línea", async () => {
    serveBytes([encode(JSON.stringify({ response: JSON.stringify(validHistoria()), done: true }))]);

    const result = await newTransformer().processContext(ticket({ issueType: "Historia" }), "historia");

    expect(result.kind).toBe("Ok");
  });

  it("une un carácter multibyte (ñ) partido entre dos trozos de red", async () => {
    const bytes = encode(JSON.stringify({ response: JSON.stringify(validBug()), done: true }) + "\n");
    // La «ñ» de «Peña» son dos bytes (0xC3 0xB1): se corta justo entre ellos.
    const at = bytes.findIndex((b, i) => b === 0xc3 && bytes[i + 1] === 0xb1);
    expect(at).toBeGreaterThan(0);
    serveBytes([bytes.slice(0, at + 1), bytes.slice(at + 1)]);

    const result = await newTransformer().processContext(ticket(), "bug");

    expect(result.kind === "Ok" && result.value.pasosParaReproducir?.[1]).toBe("Ingresar el usuario 'Peña'.");
  });
});
