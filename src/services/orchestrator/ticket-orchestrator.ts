import type { SQLiteStorageManager } from "../../database/sqlite-storage-manager.js";
import type { StepResult } from "../../shared/errors/result.types.js";
import type { AppConfig, JiraProject, Repository } from "../../shared/types/config.types.js";
import type { GitManager } from "../git/git-manager.js";
import type { JiraRestClient } from "../jira/jira-rest-client.js";

/** Subconjunto del cliente de Jira que usa el Orquestador; permite inyectar un doble en los tests. */
export type JiraGateway = Pick<JiraRestClient, "validateProjectKey" | "listAssignedTickets" | "getMyDisplayName">;

/** Fábrica del cliente de Jira: se invoca con la configuración vigente en cada operación que llama a Jira. */
export type JiraClientFactory = (config: AppConfig) => JiraGateway;

const DEFAULT_BASE_BRANCH = "main";

/** Formato válido del sufijo de usuario de las ramas (el mismo que exige `AppConfigProvider`). */
const SUFFIX_FORMAT = /^[A-Z0-9]+$/;

/** `CLAVE-123`: la clave de proyecto es lo que precede al guion; no admite guiones propios. */
const TICKET_ID_FORMAT = /^([A-Za-z][A-Za-z0-9_]*)-\d+$/;

/** Datos de un repositorio local al darlo de alta o editarlo. Los textos se guardan sin espacios sobrantes. */
export interface RepositoryInput {
  /** Clave de un proyecto ya dado de alta (sin distinguir mayúsculas). */
  jiraProjectKey: string;
  /** Nombre del repositorio, único dentro del proyecto. */
  name: string;
  /** Ruta local del repositorio Git. */
  repoLocalPath: string;
  /** Rama base; en blanco o ausente cuenta como omitida: se conserva la del repositorio existente o, si es nuevo, `main`. */
  defaultBaseBranch?: string;
}

/**
 * Orquestador de la herramienta: única puerta de la TUI hacia Jira, Git y SQLite.
 *
 * Esta clase reúne, por ahora, los métodos de gestión de configuración, proyectos y repositorios (TK-02g);
 * `startTicket` se añade en TK-02f.
 */
export class TicketOrchestrator {
  /**
   * @param storage Storage ya migrado. Solo el Orquestador lo usa.
   * @param git Gestor de Git (validación de repositorios).
   * @param createJiraClient Fábrica del cliente de Jira; se invoca con la configuración guardada en cada llamada,
   * de modo que un cambio hecho con `saveConfig` surte efecto sin reinstanciar el Orquestador.
   */
  constructor(
    private readonly storage: SQLiteStorageManager,
    private readonly git: GitManager,
    private readonly createJiraClient: JiraClientFactory,
  ) {}

  /**
   * Lista las claves de proyecto dadas de alta.
   *
   * @returns Los proyectos ordenados por clave; arreglo vacío si no hay ninguno.
   */
  listProjects(): JiraProject[] {
    return this.storage.listJiraProjects();
  }

  /**
   * Da de alta una clave de proyecto tras validarla contra Jira (`GET /project/{key}`).
   *
   * Solo persiste si Jira devuelve `Ok`; en cualquier otro caso no escribe nada.
   *
   * @param key Clave de proyecto; se normaliza a mayúsculas.
   * @returns `Ok` con el proyecto guardado (con el nombre que devolvió Jira); el `FallbackManual` o `ErrorBloqueante`
   * de Jira tal cual; o `ErrorBloqueante('ErrorInesperado')` si aún no hay configuración de Jira.
   */
  async addProject(key: string): Promise<StepResult<JiraProject>> {
    const jira = this.jiraClient();
    if (jira.kind !== "Ok") return jira;
    const normalized = key.trim().toUpperCase();
    const validated = await jira.value.validateProjectKey(normalized);
    if (validated.kind !== "Ok") return validated;
    const project = this.storage.upsertJiraProject({
      jiraProjectKey: validated.value.key,
      jiraProjectName: validated.value.name,
    });
    return { kind: "Ok", value: project };
  }

  /**
   * Quita una clave de proyecto (y, en cascada, sus repositorios). No falla si la clave no existe.
   *
   * @param key Clave de proyecto; se normaliza a mayúsculas, como en {@link addProject}.
   * @throws {Error} Con un mensaje claro si el proyecto tiene tickets registrados en el historial; no se borra nada.
   */
  removeProject(key: string): void {
    const normalized = key.trim().toUpperCase();
    removeKeepingHistory(`el proyecto ${normalized}`, () => this.storage.removeJiraProject(normalized));
  }

  /**
   * Da de alta un repositorio local tras validarlo con Git (repositorio, remoto `origin` y rama base en el remoto).
   *
   * Solo persiste si la validación devuelve `Ok`. Si ya existe un repositorio con ese nombre en el proyecto,
   * se actualiza su ruta conservando el `id` y, si se omite `defaultBaseBranch`, también su rama base.
   *
   * @param input Proyecto, nombre, ruta y rama base; ver {@link RepositoryInput}. Los textos se recortan, así que `"api "` y `"api"`
   * son el mismo repositorio. Sin rama base se conserva la del repositorio existente con ese nombre y, solo si es nuevo, se usa `main`.
   * @returns `Ok` con el repositorio guardado; el `ErrorBloqueante` o el `FallbackManual` de Git tal cual (sin escribir nada);
   * o `ErrorBloqueante('ErrorInesperado')` con las claves disponibles si el proyecto no está configurado (sin llamar a Git).
   */
  async addRepository(rawInput: RepositoryInput): Promise<StepResult<Repository>> {
    const input = normalizeRepositoryInput(rawInput);
    const project = this.findProject(input.jiraProjectKey);
    if (project.kind !== "Ok") return project;
    const existing = this.storage.listRepositories(project.value.id).find((r) => r.name === input.name);
    return this.validateAndSave(project.value, input, input.defaultBaseBranch ?? existing?.defaultBaseBranch ?? DEFAULT_BASE_BRANCH);
  }

  /**
   * Actualiza la ruta o la rama base de un repositorio ya dado de alta, volviendo a validarlo con Git.
   * No permite renombrarlo: se identifica por `(proyecto, nombre)`.
   *
   * @param input Los mismos campos que {@link addRepository}, recortados igual. Sin `defaultBaseBranch` se conserva (y valida) la ya guardada.
   * @returns `Ok` con el repositorio actualizado (mismo `id`); el `ErrorBloqueante` de Git tal cual, sin cambiar lo guardado;
   * `ErrorBloqueante('RepositorioNoEncontrado')` si el repositorio no existe en ese proyecto; o `ErrorBloqueante('ErrorInesperado')`
   * si el proyecto no está configurado.
   */
  async updateRepository(rawInput: RepositoryInput): Promise<StepResult<Repository>> {
    const input = normalizeRepositoryInput(rawInput);
    const project = this.findProject(input.jiraProjectKey);
    if (project.kind !== "Ok") return project;
    const existing = this.storage.listRepositories(project.value.id).find((r) => r.name === input.name);
    if (!existing) {
      return {
        kind: "ErrorBloqueante",
        subtype: "RepositorioNoEncontrado",
        message: `El proyecto ${project.value.jiraProjectKey} no tiene un repositorio llamado «${input.name}».`,
      };
    }
    return this.validateAndSave(project.value, input, input.defaultBaseBranch ?? existing.defaultBaseBranch);
  }

  /**
   * Quita un repositorio. No falla si el `id` no existe.
   *
   * @param repositoryId `id` del repositorio.
   * @throws {Error} Con un mensaje claro si el repositorio tiene tickets registrados en el historial; no se borra nada.
   */
  removeRepository(repositoryId: number): void {
    removeKeepingHistory(`el repositorio #${repositoryId}`, () => this.storage.removeRepository(repositoryId));
  }

  /**
   * Lista los repositorios entre los que la TUI hace elegir al iniciar un ticket. No llama a Jira.
   *
   * @param ticketId ID del ticket (p. ej. `SCRUM-12`); la clave del proyecto sale de su prefijo.
   * @returns `Ok` con los repositorios del proyecto (vacío si no tiene ninguno: se genera solo el documento);
   * `ErrorBloqueante('ErrorInesperado')` con las claves disponibles si el ID está mal formado o su clave no está configurada.
   */
  listRepositoriesForTicket(ticketId: string): StepResult<Repository[]> {
    const key = TICKET_ID_FORMAT.exec(ticketId.trim())?.[1];
    if (key === undefined) {
      return this.unknownProject(`«${ticketId}» no es un ID de ticket válido (se espera, p. ej., SCRUM-12)`, false);
    }
    const project = this.findProject(key);
    if (project.kind !== "Ok") return project;
    return { kind: "Ok", value: this.storage.listRepositories(project.value.id) };
  }

  /** Busca un proyecto dado de alta por su clave (sin distinguir mayúsculas) o explica cuáles hay. */
  private findProject(key: string): StepResult<JiraProject> {
    const normalized = key.trim().toUpperCase();
    const project = this.storage.getJiraProject(normalized);
    if (project) return { kind: "Ok", value: project };
    return this.unknownProject(`La clave de proyecto «${normalized}» no está configurada`);
  }

  /**
   * Error de «proyecto no configurado» con las claves que sí lo están.
   *
   * @param suggestAdding `false` cuando la causa es un ID mal escrito: ahí no se sugiere dar de alta una clave.
   */
  private unknownProject(reason: string, suggestAdding = true): StepResult<never> {
    const keys = this.storage.listJiraProjects().map((p) => p.jiraProjectKey);
    const available = keys.length > 0 ? keys.join(", ") : "ninguna";
    return {
      kind: "ErrorBloqueante",
      subtype: "ErrorInesperado",
      message: `${reason}. Claves disponibles: ${available}.${suggestAdding ? " Agrega la clave con «devflow config proyectos»." : ""}`,
    };
  }

  /** Valida el repositorio con Git y, solo si devuelve `Ok`, lo guarda. */
  private async validateAndSave(
    project: JiraProject,
    input: { name: string; repoLocalPath: string },
    baseBranch: string,
  ): Promise<StepResult<Repository>> {
    const validated = await this.git.validateRepository({ repoLocalPath: input.repoLocalPath, baseBranch });
    if (validated.kind !== "Ok") return validated;
    const repository = this.storage.upsertRepository({
      jiraProjectId: project.id,
      name: input.name,
      repoLocalPath: input.repoLocalPath,
      defaultBaseBranch: baseBranch,
    });
    return { kind: "Ok", value: repository };
  }

  /**
   * Devuelve la configuración global guardada.
   *
   * @returns La configuración, o `null` si aún no se configuró nada.
   */
  getConfig(): AppConfig | null {
    return this.storage.getAppConfig();
  }

  /**
   * Guarda la configuración global; solo cambian los campos indicados.
   *
   * @param config Campos a guardar. Los textos se guardan sin espacios sobrantes y uno en blanco se ignora (conserva el valor
   * guardado), como en `AppConfigProvider`. El sufijo de usuario, si viene, debe cumplir `^[A-Z0-9]+$` (p. ej. `AROCHA`).
   * @throws {Error} Si el sufijo (ya recortado) no cumple el formato, en blanco incluido (no se guarda nada) o, en el primer alta, si faltan campos obligatorios
   * (`jiraBaseUrl`, `jiraEmail`, `jiraApiToken`, `branchUserSuffix`, `ticketsRootPath`).
   */
  saveConfig(config: Partial<AppConfig>): void {
    const cleaned: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(config)) {
      const trimmed = typeof value === "string" ? value.trim() : value;
      if (trimmed === "" && field !== "branchUserSuffix") continue;
      cleaned[field] = trimmed;
    }
    const suffix = cleaned.branchUserSuffix;
    if (suffix !== undefined && !SUFFIX_FORMAT.test(suffix as string)) {
      throw new Error(`El sufijo de usuario «${suffix as string}» no es válido: debe cumplir ^[A-Z0-9]+$ (p. ej. AROCHA).`);
    }
    this.storage.upsertAppConfig(cleaned as Partial<AppConfig>);
  }

  /**
   * Sugiere el sufijo de usuario de las ramas a partir del nombre visible de la cuenta de Jira (`/myself`).
   *
   * La sugerencia es la inicial del nombre más el último apellido, en mayúsculas y sin acentos
   * («Andrea Rocha» → `AROCHA`); un nombre de una sola palabra se usa completo. El usuario puede editarla.
   *
   * @returns `Ok` con el sufijo; el fallo de Jira tal cual; o `ErrorBloqueante('ErrorInesperado')` si no hay configuración
   * de Jira o el nombre no contiene letras A-Z ni dígitos (el usuario debe escribirlo a mano).
   */
  async suggestBranchSuffix(): Promise<StepResult<string>> {
    const jira = this.jiraClient();
    if (jira.kind !== "Ok") return jira;
    const name = await jira.value.getMyDisplayName();
    if (name.kind !== "Ok") return name;
    const suffix = suffixFromName(name.value);
    if (suffix === null) {
      return {
        kind: "ErrorBloqueante",
        subtype: "ErrorInesperado",
        message: `No se pudo sugerir un sufijo a partir del nombre «${name.value}». Escríbelo a mano (solo A-Z y 0-9).`,
      };
    }
    return { kind: "Ok", value: suffix };
  }

  /**
   * Lista los tickets abiertos asignados al usuario en las claves de proyecto dadas de alta.
   *
   * @returns `Ok` con hasta 50 tickets (`Ok([])` sin llamar a Jira si no hay proyectos dados de alta); el fallo de Jira
   * tal cual; o `ErrorBloqueante('ErrorInesperado')` si aún no hay configuración de Jira.
   */
  async listAssignedTickets(): Promise<StepResult<Array<{ ticketId: string; title: string; issueType: string }>>> {
    const jira = this.jiraClient();
    if (jira.kind !== "Ok") return jira;
    const keys = this.storage.listJiraProjects().map((p) => p.jiraProjectKey);
    if (keys.length === 0) return { kind: "Ok", value: [] };
    return jira.value.listAssignedTickets(keys);
  }

  /** Crea el cliente de Jira con la configuración guardada, o indica que falta configurarla. */
  private jiraClient(): StepResult<JiraGateway> {
    const config = this.storage.getAppConfig();
    if (!config) {
      return {
        kind: "ErrorBloqueante",
        subtype: "ErrorInesperado",
        message: "Falta la configuración de Jira. Ejecuta «devflow config» primero.",
      };
    }
    return { kind: "Ok", value: this.createJiraClient(config) };
  }
}

/**
 * Ejecuta un borrado y traduce la violación de clave foránea (el elemento tiene historial en `ticket_logs`)
 * a un mensaje claro; cualquier otro error se relanza tal cual.
 */
function removeKeepingHistory(what: string, remove: () => void): void {
  try {
    remove();
  } catch (error) {
    if (error instanceof Error && error.message.includes("FOREIGN KEY constraint failed")) {
      throw new Error(
        `No se puede quitar ${what}: tiene tickets registrados en el historial. Se conserva para no perder esos registros.`,
        { cause: error },
      );
    }
    throw error;
  }
}

/** Recorta los textos del repositorio; una rama base en blanco pasa a ausente. */
function normalizeRepositoryInput(input: RepositoryInput): RepositoryInput {
  const defaultBaseBranch = input.defaultBaseBranch?.trim();
  return {
    jiraProjectKey: input.jiraProjectKey,
    name: input.name.trim(),
    repoLocalPath: input.repoLocalPath.trim(),
    ...(defaultBaseBranch ? { defaultBaseBranch } : {}),
  };
}

/** Inicial del nombre + último apellido, en `[A-Z0-9]`; `null` si el nombre no deja ningún carácter válido. */
function suffixFromName(displayName: string): string | null {
  const words = displayName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Z0-9]/g, ""))
    .filter((word) => word.length > 0);
  const [first] = words;
  const last = words.at(-1);
  if (first === undefined || last === undefined) return null;
  return words.length === 1 ? first : `${first.charAt(0)}${last}`;
}
