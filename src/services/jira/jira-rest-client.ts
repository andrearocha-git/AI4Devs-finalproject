import type { StepResult } from "../../shared/errors/result.types.js";
import type { ContextoTicket } from "../../shared/types/ticket-context.types.js";

/** Configuración del cliente: llega entera por constructor, el cliente no lee `AppConfig` ni el entorno. */
export interface JiraRestClientOptions {
  /** URL base de la instancia de Jira Cloud (`https://<sitio>.atlassian.net`); se ignora una barra final. */
  baseUrl: string;
  /** Email de la cuenta Atlassian; junto con el token forma la autenticación Basic. */
  email: string;
  /** API Token clásico; junto con el email forma la autenticación Basic. */
  apiToken: string;
  /** Timeout por intento, en segundos (admite fracciones). */
  timeoutSeconds: number;
  /** Espera antes del reintento (backoff corto). Por defecto 2000 ms; los tests lo bajan a 0. */
  retryDelayMs?: number;
  /** Espera inyectable (por defecto `setTimeout`); permite probar el reintento y `Retry-After` sin esperar de verdad. */
  sleep?: (ms: number) => Promise<void>;
}

/** Tope de la espera pedida por `Retry-After`, para no bloquear la TUI indefinidamente. */
const MAX_RETRY_AFTER_MS = 30_000;

/** Resultado de un intento HTTP: respuesta recibida, o sin respuesta (timeout o error de red). */
type Attempt = { kind: "response"; response: Response } | { kind: "unreachable" };

/** Comprueba que un campo de la respuesta de Jira sea texto; si no, lanza para que `parse` lo traduzca a `ErrorInesperado`. */
function expectString(value: unknown): string {
  if (typeof value !== "string") throw new Error("Campo de texto ausente en la respuesta de Jira");
  return value;
}

/** Como `expectString`, pero admite ausente o `null` (se trata como cadena vacía); cualquier otro tipo lanza. */
function optionalString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return expectString(value);
}

/** Formato de una clave de proyecto de Jira (el mismo que el de la clave dentro de un ID de ticket). */
const PROJECT_KEY_FORMAT = /^[A-Z][A-Z0-9_]+$/;

const networkTimeout = { kind: "FallbackManual", reason: "network_timeout" } as const;
const invalidToken = { kind: "FallbackManual", reason: "invalid_token" } as const;

interface JiraIssueResponse {
  fields: { summary: unknown; description?: unknown; issuetype: { name: unknown } };
}

/**
 * Cliente de la API REST v2 de Jira Cloud (HTTP directo con Basic email + token, sin MCP; ADR-005.1).
 *
 * Todos sus métodos devuelven un `StepResult`: ninguna falla de red o de credenciales llega al llamador como excepción.
 */
export class JiraRestClient {
  private readonly baseUrl: string;
  private readonly hasValidBaseUrl: boolean;
  private readonly authorization: string;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  /** @param options Host, credenciales y timeouts; ver {@link JiraRestClientOptions}. */
  constructor(options: JiraRestClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.hasValidBaseUrl = URL.canParse(this.baseUrl);
    this.authorization = `Basic ${Buffer.from(`${options.email}:${options.apiToken}`).toString("base64")}`;
    this.timeoutMs = options.timeoutSeconds * 1000;
    this.retryDelayMs = options.retryDelayMs ?? 2000;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /**
   * Obtiene un ticket y lo mapea de forma determinista a `ContextoTicket` (sin LLM).
   *
   * @param ticketId Clave del ticket (p. ej. `SCRUM-12`); se codifica en la URL.
   * @returns `Ok` con el contexto (`description` en texto plano, `""` si Jira la devuelve vacía o `null`);
   * `FallbackManual` con el motivo si Jira no responde (`network_timeout`, tras un reintento), rechaza el token
   * (`invalid_token`) o el ticket no existe (`not_found`); `ErrorBloqueante('ErrorInesperado')` ante otro código HTTP,
   * una URL base inválida o un cuerpo 2xx cuyos campos no son del tipo esperado (p. ej. `summary: null`).
   */
  fetchTicket(ticketId: string): Promise<StepResult<ContextoTicket>> {
    return this.call(`/rest/api/2/issue/${encodeURIComponent(ticketId)}?fields=summary,description,issuetype`, (body) => {
      const issue = body as JiraIssueResponse;
      return {
        ticketId,
        title: expectString(issue.fields.summary),
        description: optionalString(issue.fields.description),
        issueType: expectString(issue.fields.issuetype.name),
        source: "jira" as const,
      };
    });
  }

  /**
   * Valida que una clave de proyecto exista en Jira (US-01 CA1-2).
   *
   * @param key Clave de proyecto (p. ej. `SCRUM`); se codifica en la URL.
   * @returns `Ok` con la clave y el nombre del proyecto; `FallbackManual('not_found')` si la clave no existe y
   * `FallbackManual('invalid_token')` si el 404 se debe a un token inválido (regla del 404 con `/myself`);
   * el resto de fallos se clasifica igual que en `fetchTicket`.
   */
  validateProjectKey(key: string): Promise<StepResult<{ key: string; name: string }>> {
    return this.call(`/rest/api/2/project/${encodeURIComponent(key)}`, (body) => {
      const project = body as { key: unknown; name: unknown };
      return { key: expectString(project.key), name: expectString(project.name) };
    });
  }

  /**
   * Lista los tickets abiertos asignados al usuario en las claves dadas, del más reciente al más antiguo.
   *
   * @param projectKeys Claves de proyecto dadas de alta. Con una lista vacía devuelve `Ok([])` sin llamar a Jira
   * (una JQL con `project in ()` es inválida). Cada clave debe cumplir `^[A-Z][A-Z0-9_]+$`: se interpolan en la JQL
   * y una clave con sintaxis JQL podría ampliar la consulta a otros proyectos.
   * @returns `Ok` con hasta 50 tickets (sin paginación, MVP); `ErrorBloqueante('ErrorInesperado')` nombrando la
   * clave, sin llamar a Jira, si alguna no cumple el formato; o el fallo clasificado como en `fetchTicket`.
   */
  listAssignedTickets(
    projectKeys: string[],
  ): Promise<StepResult<Array<{ ticketId: string; title: string; issueType: string }>>> {
    if (projectKeys.length === 0) return Promise.resolve({ kind: "Ok", value: [] });
    const invalidKey = projectKeys.find((key) => !PROJECT_KEY_FORMAT.test(key));
    if (invalidKey !== undefined) {
      return Promise.resolve({
        kind: "ErrorBloqueante",
        subtype: "ErrorInesperado",
        message: `La clave de proyecto «${invalidKey}» no tiene un formato válido (se espera, p. ej., SCRUM).`,
      });
    }
    const jql = `project in (${projectKeys.join(", ")}) AND assignee = currentUser() AND statusCategory != Done AND issuetype != Epic ORDER BY updated DESC`;
    return this.call(`/rest/api/2/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,issuetype&maxResults=50`, (body) => {
      const { issues } = body as { issues: unknown };
      if (!Array.isArray(issues)) throw new Error("issues no es una lista");
      return issues.map((issue: JiraIssueResponse & { key: string }) => ({
        ticketId: expectString(issue.key),
        title: expectString(issue.fields.summary),
        issueType: expectString(issue.fields.issuetype.name),
      }));
    });
  }

  /**
   * Obtiene el nombre visible de la cuenta (`/myself`), del que se sugiere el sufijo de usuario (US-01 CA4).
   *
   * @returns `Ok` con el `displayName`, o el fallo clasificado como en `fetchTicket`.
   */
  getMyDisplayName(): Promise<StepResult<string>> {
    return this.call("/rest/api/2/myself", (body) => expectString((body as { displayName: unknown }).displayName));
  }

  /**
   * Hace la petición, clasifica el resultado y, si es 2xx, mapea el cuerpo JSON.
   * Un 404 se distingue con `/myself`: 401/403 = token inválido, 200 = el recurso no existe.
   */
  private async call<T>(path: string, map: (body: unknown) => T): Promise<StepResult<T>> {
    if (!this.hasValidBaseUrl) {
      return {
        kind: "ErrorBloqueante",
        subtype: "ErrorInesperado",
        message: "La URL base de Jira no es válida; revisa la configuración (jiraBaseUrl).",
      };
    }
    const attempt = await this.request(path);
    if (attempt.kind === "unreachable") return networkTimeout;
    const { response } = attempt;
    if (response.ok) return this.parse(response, map);
    if (response.status === 401 || response.status === 403) return invalidToken;
    if (response.status === 404) return this.classifyNotFound();
    if (response.status === 429 || response.status >= 500) return networkTimeout;
    return { kind: "ErrorBloqueante", subtype: "ErrorInesperado", message: `Jira respondió ${response.status}.` };
  }

  /** Mapea el cuerpo de una 2xx; un cuerpo que no es JSON o no tiene la forma esperada es `ErrorInesperado`, nunca una excepción. */
  private async parse<T>(response: Response, map: (body: unknown) => T): Promise<StepResult<T>> {
    try {
      return { kind: "Ok", value: map(await response.json()) };
    } catch {
      return {
        kind: "ErrorBloqueante",
        subtype: "ErrorInesperado",
        message: "Jira devolvió una respuesta con un formato inesperado.",
      };
    }
  }

  /** Aplica la regla del 404: pregunta a `/myself` si el token es válido para decidir entre `invalid_token` y `not_found`. */
  private async classifyNotFound(): Promise<StepResult<never>> {
    const attempt = await this.request("/rest/api/2/myself");
    if (attempt.kind === "unreachable") return networkTimeout;
    const { status } = attempt.response;
    if (attempt.response.ok) return { kind: "FallbackManual", reason: "not_found" };
    if (status === 401 || status === 403) return invalidToken;
    return networkTimeout;
  }

  /** Un intento más si falló por algo transitorio (timeout, red, 5xx, 429), esperando `Retry-After` (con tope) o el backoff. */
  private async request(path: string): Promise<Attempt> {
    const first = await this.send(path);
    const waitMs = this.retryWaitMs(first);
    if (waitMs === undefined) return first;
    await this.sleep(waitMs);
    return this.send(path);
  }

  /** Milisegundos a esperar antes de reintentar, o `undefined` si el resultado no es transitorio. */
  private retryWaitMs(attempt: Attempt): number | undefined {
    if (attempt.kind === "unreachable") return this.retryDelayMs;
    const { status, headers } = attempt.response;
    if (status >= 500) return this.retryDelayMs;
    if (status !== 429) return undefined;
    const retryAfter = headers.get("Retry-After");
    const seconds = retryAfter === null ? NaN : Number(retryAfter);
    return Number.isFinite(seconds) ? Math.max(0, Math.min(seconds * 1000, MAX_RETRY_AFTER_MS)) : this.retryDelayMs;
  }

  private async send(path: string): Promise<Attempt> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        headers: { Authorization: this.authorization, Accept: "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return { kind: "response", response };
    } catch {
      return { kind: "unreachable" };
    }
  }
}
