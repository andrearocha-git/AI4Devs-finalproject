import { readFileSync } from "node:fs";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { JiraRestClient } from "../../../../src/services/jira/jira-rest-client.js";

const BASE_URL = "https://equipo.atlassian.net";
const EMAIL = "dev@example.com";
const TOKEN = "token-de-prueba";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function fixture(name: string): { key: string; fields: { summary: string; description: string | null; issuetype: { name: string } } } {
  return JSON.parse(readFileSync(new URL(`../../../fixtures/tickets/${name}`, import.meta.url), "utf8"));
}

function newClient(overrides: Partial<ConstructorParameters<typeof JiraRestClient>[0]> = {}): JiraRestClient {
  return new JiraRestClient({
    baseUrl: BASE_URL,
    email: EMAIL,
    apiToken: TOKEN,
    timeoutSeconds: 1,
    retryDelayMs: 0,
    ...overrides,
  });
}

describe("E1 — fetchTicket: mapeo y credenciales por constructor (TK-02b CA1 caso 200, DoD-a)", () => {
  function serveIssue(name: string): { requests: Request[] } {
    const requests: Request[] = [];
    const data = fixture(name);
    server.use(
      http.get(`${BASE_URL}/rest/api/2/issue/:id`, ({ request }) => {
        requests.push(request);
        return HttpResponse.json({ id: "1", ...data });
      }),
    );
    return { requests };
  }

  it("mapea un bug completo a ContextoTicket", async () => {
    serveIssue("bug-completo.json");
    const result = await newClient().fetchTicket("SCRUM-12");
    const data = fixture("bug-completo.json");
    expect(result).toEqual({
      kind: "Ok",
      value: {
        ticketId: "SCRUM-12",
        title: data.fields.summary,
        description: data.fields.description,
        issueType: "Bug",
        source: "jira",
      },
    });
  });

  it.each([
    ["historia-escueta.json", "SCRUM-22", "Tarea"],
    ["bug-escueto.json", "SCRUM-13", "Error"],
  ])("mapea una descripción vacía o null (%s) a cadena vacía", async (file, key, issueType) => {
    serveIssue(file);
    const result = await newClient().fetchTicket(key);
    expect(result).toMatchObject({ kind: "Ok", value: { ticketId: key, description: "", issueType, source: "jira" } });
  });

  it("usa el host, las credenciales Basic y los campos pedidos del constructor", async () => {
    const { requests } = serveIssue("bug-completo.json");
    await newClient({ baseUrl: `${BASE_URL}/` }).fetchTicket("SCRUM-12");
    const request = requests[0] as Request;
    const url = new URL(request.url);
    expect(url.origin).toBe(BASE_URL);
    expect(url.pathname).toBe("/rest/api/2/issue/SCRUM-12");
    expect(url.searchParams.get("fields")).toBe("summary,description,issuetype");
    expect(request.headers.get("authorization")).toBe(`Basic ${Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64")}`);
  });

  it("codifica el ID del ticket en la URL", async () => {
    const { requests } = serveIssue("bug-completo.json");
    await newClient().fetchTicket("A B/1");
    expect(new URL((requests[0] as Request).url).pathname).toBe("/rest/api/2/issue/A%20B%2F1");
  });
});

describe("E2 — fetchTicket: clasificación de fallos, reintento y regla del 404 (TK-02b CA1 fallos, DoD-b)", () => {
  const issueUrl = `${BASE_URL}/rest/api/2/issue/:id`;
  const myselfUrl = `${BASE_URL}/rest/api/2/myself`;

  /** Registra las llamadas a `sleep` sin esperar de verdad. */
  function sleepSpy(): { calls: number[]; sleep: (ms: number) => Promise<void> } {
    const calls: number[] = [];
    return { calls, sleep: async (ms) => void calls.push(ms) };
  }

  /** Cuenta las peticiones a una URL y responde según el número de intento (empieza en 1). */
  function respondBy(url: string, reply: (attempt: number) => Response | Promise<Response>): { count: () => number } {
    let attempts = 0;
    server.use(http.get(url, () => reply(++attempts)));
    return { count: () => attempts };
  }

  const ok = () => HttpResponse.json(fixture("bug-completo.json"));
  const status = (code: number, headers?: Record<string, string>) => new HttpResponse(null, { status: code, headers });

  describe("timeout, errores de red y 5xx", () => {
    it("un timeout persistente se reintenta una vez y termina en network_timeout", async () => {
      const issue = respondBy(issueUrl, async () => {
        await delay(300);
        return ok();
      });
      const result = await newClient({ timeoutSeconds: 0.05 }).fetchTicket("SCRUM-12");
      expect(result).toEqual({ kind: "FallbackManual", reason: "network_timeout" });
      expect(issue.count()).toBe(2);
    });

    it("un timeout que se resuelve en el reintento devuelve Ok, esperando retryDelayMs entre intentos", async () => {
      const { calls, sleep } = sleepSpy();
      const issue = respondBy(issueUrl, async (attempt) => {
        if (attempt === 1) await delay(300);
        return ok();
      });
      const result = await newClient({ timeoutSeconds: 0.05, retryDelayMs: 1500, sleep }).fetchTicket("SCRUM-12");
      expect(result.kind).toBe("Ok");
      expect(issue.count()).toBe(2);
      expect(calls).toEqual([1500]);
    });

    it("un 503 persistente se reintenta una vez y termina en network_timeout", async () => {
      const issue = respondBy(issueUrl, () => status(503));
      const result = await newClient().fetchTicket("SCRUM-12");
      expect(result).toEqual({ kind: "FallbackManual", reason: "network_timeout" });
      expect(issue.count()).toBe(2);
    });

    it("un error de red se reintenta una vez y termina en network_timeout", async () => {
      const issue = respondBy(issueUrl, () => HttpResponse.error());
      const result = await newClient().fetchTicket("SCRUM-12");
      expect(result).toEqual({ kind: "FallbackManual", reason: "network_timeout" });
      expect(issue.count()).toBe(2);
    });
  });

  describe("credenciales", () => {
    it.each([401, 403])("un %i da invalid_token sin reintentar", async (code) => {
      const issue = respondBy(issueUrl, () => status(code));
      const result = await newClient().fetchTicket("SCRUM-12");
      expect(result).toEqual({ kind: "FallbackManual", reason: "invalid_token" });
      expect(issue.count()).toBe(1);
    });
  });

  describe("regla del 404 con /myself", () => {
    it.each([401, 403])("404 seguido de /myself %i da invalid_token", async (code) => {
      respondBy(issueUrl, () => status(404));
      respondBy(myselfUrl, () => status(code));
      expect(await newClient().fetchTicket("SCRUM-12")).toEqual({ kind: "FallbackManual", reason: "invalid_token" });
    });

    it("404 seguido de /myself 200 da not_found, sin reintentar el 404", async () => {
      const issue = respondBy(issueUrl, () => status(404));
      respondBy(myselfUrl, () => HttpResponse.json({ displayName: "Andrea Rocha" }));
      expect(await newClient().fetchTicket("SCRUM-12")).toEqual({ kind: "FallbackManual", reason: "not_found" });
      expect(issue.count()).toBe(1);
    });

    it("404 y luego /myself sin respuesta da network_timeout", async () => {
      respondBy(issueUrl, () => status(404));
      respondBy(myselfUrl, () => status(503));
      expect(await newClient().fetchTicket("SCRUM-12")).toEqual({ kind: "FallbackManual", reason: "network_timeout" });
    });
  });

  describe("429 con Retry-After", () => {
    it("espera lo indicado y reintenta una vez", async () => {
      const { calls, sleep } = sleepSpy();
      const issue = respondBy(issueUrl, (attempt) => (attempt === 1 ? status(429, { "Retry-After": "3" }) : ok()));
      const result = await newClient({ sleep }).fetchTicket("SCRUM-12");
      expect(result.kind).toBe("Ok");
      expect(calls).toEqual([3000]);
      expect(issue.count()).toBe(2);
    });

    it("si el reintento también da 429 termina en network_timeout", async () => {
      const { sleep } = sleepSpy();
      const issue = respondBy(issueUrl, () => status(429, { "Retry-After": "1" }));
      const result = await newClient({ sleep }).fetchTicket("SCRUM-12");
      expect(result).toEqual({ kind: "FallbackManual", reason: "network_timeout" });
      expect(issue.count()).toBe(2);
    });

    it("sin cabecera usa retryDelayMs", async () => {
      const { calls, sleep } = sleepSpy();
      respondBy(issueUrl, (attempt) => (attempt === 1 ? status(429) : ok()));
      await newClient({ retryDelayMs: 7, sleep }).fetchTicket("SCRUM-12");
      expect(calls).toEqual([7]);
    });

    it("limita la espera a 30 s", async () => {
      const { calls, sleep } = sleepSpy();
      respondBy(issueUrl, (attempt) => (attempt === 1 ? status(429, { "Retry-After": "120" }) : ok()));
      await newClient({ sleep }).fetchTicket("SCRUM-12");
      expect(calls).toEqual([30000]);
    });
  });

  it("otros códigos inesperados dan ErrorBloqueante('ErrorInesperado') con el código", async () => {
    respondBy(issueUrl, () => status(400));
    const result = await newClient().fetchTicket("SCRUM-12");
    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(result.kind === "ErrorBloqueante" && result.message).toContain("400");
  });
});

describe("E3 — claves, tickets asignados y nombre de la cuenta (TK-02b CA1 validateProjectKey, métodos sin CA numerado)", () => {
  const projectUrl = `${BASE_URL}/rest/api/2/project/:key`;
  const searchUrl = `${BASE_URL}/rest/api/2/search/jql`;
  const myselfUrl = `${BASE_URL}/rest/api/2/myself`;
  const status = (code: number) => new HttpResponse(null, { status: code });

  describe("validateProjectKey", () => {
    it("devuelve la clave y el nombre del proyecto", async () => {
      server.use(http.get(projectUrl, () => HttpResponse.json({ key: "SCRUM", name: "Mi Team", id: "10000" })));
      expect(await newClient().validateProjectKey("SCRUM")).toEqual({ kind: "Ok", value: { key: "SCRUM", name: "Mi Team" } });
    });

    it("codifica la clave en la URL", async () => {
      let pathname = "";
      server.use(
        http.get(projectUrl, ({ request }) => {
          pathname = new URL(request.url).pathname;
          return HttpResponse.json({ key: "X", name: "X" });
        }),
      );
      await newClient().validateProjectKey("A B");
      expect(pathname).toBe("/rest/api/2/project/A%20B");
    });

    it("404 con /myself 200 da not_found (la clave no existe)", async () => {
      server.use(http.get(projectUrl, () => status(404)), http.get(myselfUrl, () => HttpResponse.json({ displayName: "A" })));
      expect(await newClient().validateProjectKey("NOPE")).toEqual({ kind: "FallbackManual", reason: "not_found" });
    });

    it("404 con /myself 401 da invalid_token (no dice que la clave no existe)", async () => {
      server.use(http.get(projectUrl, () => status(404)), http.get(myselfUrl, () => status(401)));
      expect(await newClient().validateProjectKey("SCRUM")).toEqual({ kind: "FallbackManual", reason: "invalid_token" });
    });
  });

  describe("listAssignedTickets", () => {
    const searchResponse = {
      issues: [
        { key: "SCRUM-2", fields: { summary: "Primer ticket", issuetype: { name: "Bug" } } },
        { key: "APP-7", fields: { summary: "Segundo ticket", issuetype: { name: "Historia" } } },
      ],
    };

    it("envía la JQL de asignados y mapea los resultados", async () => {
      let url = new URL(BASE_URL);
      server.use(
        http.get(searchUrl, ({ request }) => {
          url = new URL(request.url);
          return HttpResponse.json(searchResponse);
        }),
      );
      const result = await newClient().listAssignedTickets(["SCRUM", "APP"]);
      expect(url.searchParams.get("jql")).toBe(
        "project in (SCRUM, APP) AND assignee = currentUser() AND statusCategory != Done AND issuetype != Epic ORDER BY updated DESC",
      );
      expect(url.searchParams.get("fields")).toBe("summary,issuetype");
      expect(url.searchParams.get("maxResults")).toBe("50");
      expect(result).toEqual({
        kind: "Ok",
        value: [
          { ticketId: "SCRUM-2", title: "Primer ticket", issueType: "Bug" },
          { ticketId: "APP-7", title: "Segundo ticket", issueType: "Historia" },
        ],
      });
    });

    it("sin claves devuelve Ok([]) sin llamar a Jira", async () => {
      // onUnhandledFrame: "error" haría fallar la petición si el cliente llamara a Jira
      expect(await newClient().listAssignedTickets([])).toEqual({ kind: "Ok", value: [] });
    });

    it("sin resultados devuelve Ok([])", async () => {
      server.use(http.get(searchUrl, () => HttpResponse.json({ issues: [] })));
      expect(await newClient().listAssignedTickets(["SCRUM"])).toEqual({ kind: "Ok", value: [] });
    });

    it("clasifica 401 como invalid_token", async () => {
      server.use(http.get(searchUrl, () => status(401)));
      expect(await newClient().listAssignedTickets(["SCRUM"])).toEqual({ kind: "FallbackManual", reason: "invalid_token" });
    });

    it("clasifica un timeout persistente como network_timeout", async () => {
      server.use(
        http.get(searchUrl, async () => {
          await delay(300);
          return HttpResponse.json(searchResponse);
        }),
      );
      const result = await newClient({ timeoutSeconds: 0.05 }).listAssignedTickets(["SCRUM"]);
      expect(result).toEqual({ kind: "FallbackManual", reason: "network_timeout" });
    });
  });

  describe("getMyDisplayName", () => {
    it("devuelve el displayName de la cuenta", async () => {
      server.use(http.get(myselfUrl, () => HttpResponse.json({ displayName: "Andrea Rocha", accountId: "x" })));
      expect(await newClient().getMyDisplayName()).toEqual({ kind: "Ok", value: "Andrea Rocha" });
    });

    it.each([401, 403])("clasifica %i como invalid_token", async (code) => {
      server.use(http.get(myselfUrl, () => status(code)));
      expect(await newClient().getMyDisplayName()).toEqual({ kind: "FallbackManual", reason: "invalid_token" });
    });

    it("clasifica un 503 persistente como network_timeout", async () => {
      server.use(http.get(myselfUrl, () => status(503)));
      expect(await newClient().getMyDisplayName()).toEqual({ kind: "FallbackManual", reason: "network_timeout" });
    });
  });

  describe("respuestas 2xx con cuerpo inválido (decisión del desarrollador: ErrorInesperado)", () => {
    const unexpected = { kind: "ErrorBloqueante", subtype: "ErrorInesperado" };

    it("un cuerpo que no es JSON no lanza excepción", async () => {
      server.use(http.get(`${BASE_URL}/rest/api/2/issue/:id`, () => new HttpResponse("<html>no es json</html>", { status: 200 })));
      expect(await newClient().fetchTicket("SCRUM-12")).toMatchObject(unexpected);
    });

    it("un JSON con otra forma no lanza excepción", async () => {
      server.use(http.get(`${BASE_URL}/rest/api/2/issue/:id`, () => HttpResponse.json({ algo: "distinto" })));
      expect(await newClient().fetchTicket("SCRUM-12")).toMatchObject(unexpected);
    });

    it("también en los demás métodos", async () => {
      server.use(
        http.get(projectUrl, () => HttpResponse.json({})),
        http.get(searchUrl, () => HttpResponse.json({ issues: "no es una lista" })),
        http.get(myselfUrl, () => HttpResponse.json({})),
      );
      const client = newClient();
      expect(await client.validateProjectKey("SCRUM")).toMatchObject(unexpected);
      expect(await client.listAssignedTickets(["SCRUM"])).toMatchObject(unexpected);
      expect(await client.getMyDisplayName()).toMatchObject(unexpected);
    });
  });
});

describe("Revisión de la PR #2 — mapeo estricto, claves, URL base y reintentos", () => {
  const issueUrl = `${BASE_URL}/rest/api/2/issue/:id`;
  const myselfUrl = `${BASE_URL}/rest/api/2/myself`;
  const unexpected = { kind: "ErrorBloqueante", subtype: "ErrorInesperado" };
  const issueWith = (fields: Record<string, unknown>) => HttpResponse.json({ key: "SCRUM-12", fields });

  describe("fetchTicket rechaza campos con tipos incorrectos", () => {
    it.each([
      ["descripción como objeto (formato de documento)", { summary: "t", description: { type: "doc" }, issuetype: { name: "Bug" } }],
      ["summary null", { summary: null, description: "d", issuetype: { name: "Bug" } }],
      ["issuetype sin name", { summary: "t", description: "d", issuetype: {} }],
      ["issuetype ausente", { summary: "t", description: "d" }],
    ])("%s da ErrorInesperado", async (_caso, fields) => {
      server.use(http.get(issueUrl, () => issueWith(fields)));
      expect(await newClient().fetchTicket("SCRUM-12")).toMatchObject(unexpected);
    });

    it("acepta la descripción ausente y la trata como cadena vacía", async () => {
      server.use(http.get(issueUrl, () => issueWith({ summary: "t", issuetype: { name: "Bug" } })));
      expect(await newClient().fetchTicket("SCRUM-12")).toMatchObject({ kind: "Ok", value: { description: "" } });
    });
  });

  describe("listAssignedTickets valida las claves antes de armar la JQL", () => {
    it.each([
      ["inyección de JQL", ["FOO) OR (summary is not EMPTY"]],
      ["minúsculas", ["scrum"]],
      ["una válida y otra inválida", ["SCRUM", "A B"]],
      ["vacía", [""]],
    ])("%s da ErrorInesperado sin llamar a Jira", async (_caso, keys) => {
      // onUnhandledFrame: "error" haría fallar la petición si el cliente llamara a Jira
      const result = await newClient().listAssignedTickets(keys);
      expect(result).toMatchObject(unexpected);
      expect(result.kind === "ErrorBloqueante" && result.message).toContain(keys.find((k) => !/^[A-Z][A-Z0-9_]+$/.test(k)) ?? "");
    });
  });

  it("una URL base inválida da ErrorInesperado en lugar de network_timeout, sin llamar a Jira", async () => {
    const client = newClient({ baseUrl: "no-es-una-url" });
    expect(await client.fetchTicket("SCRUM-12")).toMatchObject(unexpected);
    expect(await client.getMyDisplayName()).toMatchObject(unexpected);
  });

  describe("reintentos", () => {
    it("un Retry-After negativo se acota a 0", async () => {
      const calls: number[] = [];
      let attempts = 0;
      server.use(
        http.get(issueUrl, () =>
          ++attempts === 1 ? new HttpResponse(null, { status: 429, headers: { "Retry-After": "-5" } }) : HttpResponse.json(fixture("bug-completo.json")),
        ),
      );
      const result = await newClient({ sleep: async (ms) => void calls.push(ms) }).fetchTicket("SCRUM-12");
      expect(result.kind).toBe("Ok");
      expect(calls).toEqual([0]);
    });

    it("sin retryDelayMs el backoff por defecto es de 2000 ms", async () => {
      const calls: number[] = [];
      let attempts = 0;
      server.use(
        http.get(issueUrl, () => (++attempts === 1 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json(fixture("bug-completo.json")))),
      );
      const client = new JiraRestClient({
        baseUrl: BASE_URL,
        email: EMAIL,
        apiToken: TOKEN,
        timeoutSeconds: 1,
        sleep: async (ms) => void calls.push(ms),
      });
      expect((await client.fetchTicket("SCRUM-12")).kind).toBe("Ok");
      expect(calls).toEqual([2000]);
    });

    it("un 404 con /myself caído por error de red da network_timeout", async () => {
      server.use(http.get(issueUrl, () => new HttpResponse(null, { status: 404 })), http.get(myselfUrl, () => HttpResponse.error()));
      expect(await newClient().fetchTicket("SCRUM-12")).toEqual({ kind: "FallbackManual", reason: "network_timeout" });
    });
  });
});
