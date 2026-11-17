import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { AppConfig, JiraProject, Repository, TicketLogEntry } from "../shared/types/config.types.js";

type Row = Record<string, unknown>;

const APP_CONFIG_COLUMNS: Record<string, string> = {
  jiraBaseUrl: "jira_base_url",
  jiraEmail: "jira_email",
  jiraApiToken: "jira_api_token",
  jiraTimeoutSeconds: "jira_timeout_seconds",
  ollamaHost: "ollama_host",
  ollamaModel: "ollama_model",
  ollamaTimeoutSeconds: "ollama_timeout_seconds",
  branchPrefixFeature: "branch_prefix_feature",
  branchPrefixBugfix: "branch_prefix_bugfix",
  branchUserSuffix: "branch_user_suffix",
  ticketsRootPath: "tickets_root_path",
  adjuntosDirName: "adjuntos_dir_name",
};

/** Convierte una fila de `jira_projects` (snake_case) a {@link JiraProject}. */
function toJiraProject(r: Row): JiraProject {
  return {
    id: r.id,
    jiraProjectKey: r.jira_project_key,
    jiraProjectName: r.jira_project_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  } as JiraProject;
}

/** Convierte una fila de `repositories` (snake_case) a {@link Repository}. */
function toRepository(r: Row): Repository {
  return {
    id: r.id,
    jiraProjectId: r.jira_project_id,
    name: r.name,
    repoLocalPath: r.repo_local_path,
    defaultBaseBranch: r.default_base_branch,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  } as Repository;
}

const MIGRATIONS_DIR = new URL("./migrations/", import.meta.url);

/**
 * Único módulo del sistema que accede a SQLite (ADR-002.1). Solo el Orquestador debe usarlo.
 *
 * Usa `node:sqlite` en modo WAL y con claves foráneas activadas. Las filas se devuelven con
 * claves en camelCase; las columnas de la base están en snake_case.
 */
export class SQLiteStorageManager {
  /** Handle interno; expuesto solo para que los tests inspeccionen la base. */
  readonly db: DatabaseSync;

  /**
   * Abre la conexión y activa `foreign_keys` y el modo WAL. No aplica migraciones: llamar a {@link migrate}.
   *
   * @param dbPath Ruta del archivo SQLite, o `":memory:"` para una base en memoria (tests).
   * El valor por defecto `%APPDATA%\DevFlowCLI\devflow.db` lo calcula quien instancia el manager.
   */
  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA journal_mode = WAL");
  }

  /**
   * Aplica las migraciones de `migrations/` aún no aplicadas, cada una en una transacción.
   * La versión aplicada se guarda en `PRAGMA user_version`, por lo que es idempotente.
   *
   * @throws Si una migración falla; en ese caso se revierte y el error se propaga.
   */
  migrate(): void {
    const row = this.db.prepare("PRAGMA user_version").get() as { user_version: number };
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d{4}_.+\.sql$/.test(f))
      .sort();
    for (const file of files) {
      const version = Number(file.slice(0, 4));
      if (version <= row.user_version) continue;
      this.db.exec("BEGIN");
      try {
        this.db.exec(readFileSync(new URL(file, MIGRATIONS_DIR), "utf-8"));
        this.db.exec(`PRAGMA user_version = ${version}`);
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
  }

  /**
   * Lee la configuración global (fila única, `id = 1`).
   *
   * @returns La configuración, o `null` si todavía no se configuró (arranque en frío); no lanza.
   */
  getAppConfig(): AppConfig | null {
    const r = this.db.prepare("SELECT * FROM app_config WHERE id = 1").get();
    if (!r) return null;
    return {
      id: 1,
      jiraBaseUrl: r.jira_base_url,
      jiraEmail: r.jira_email,
      jiraApiToken: r.jira_api_token,
      jiraTimeoutSeconds: r.jira_timeout_seconds,
      ollamaHost: r.ollama_host,
      ollamaModel: r.ollama_model,
      ollamaTimeoutSeconds: r.ollama_timeout_seconds,
      branchPrefixFeature: r.branch_prefix_feature,
      branchPrefixBugfix: r.branch_prefix_bugfix,
      branchUserSuffix: r.branch_user_suffix,
      ticketsRootPath: r.tickets_root_path,
      adjuntosDirName: r.adjuntos_dir_name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    } as AppConfig;
  }

  /**
   * Crea o actualiza parcialmente la configuración global (fila única, `id = 1`).
   * Si la fila existe, solo cambian los campos indicados; los `undefined` se ignoran.
   *
   * @param config Campos a guardar. `id`, `createdAt` y `updatedAt` se ignoran.
   * @throws Si es el primer alta y faltan campos obligatorios sin valor por defecto
   * (`jiraBaseUrl`, `jiraEmail`, `jiraApiToken`, `branchUserSuffix`, `ticketsRootPath`): error `NOT NULL` de SQLite.
   */
  upsertAppConfig(config: Partial<AppConfig>): void {
    const entries = Object.entries(APP_CONFIG_COLUMNS)
      .filter(([key]) => (config as Row)[key] !== undefined)
      .map(([key, column]) => ({ column, value: (config as Row)[key] }));
    if (this.db.prepare("SELECT 1 FROM app_config WHERE id = 1").get()) {
      // UPDATE: ON CONFLICT no sirve aquí, porque SQLite valida NOT NULL sobre la fila propuesta antes de resolver el conflicto.
      if (entries.length === 0) return;
      const sets = [...entries.map((e) => `${e.column} = ?`), "updated_at = CURRENT_TIMESTAMP"];
      this.db
        .prepare(`UPDATE app_config SET ${sets.join(", ")} WHERE id = 1`)
        .run(...entries.map((e) => e.value as string | number));
      return;
    }
    const columns = ["id", ...entries.map((e) => e.column)];
    this.db
      .prepare(`INSERT INTO app_config (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`)
      .run(1, ...entries.map((e) => e.value as string | number));
  }

  /**
   * Busca un proyecto de Jira por su clave.
   *
   * @param jiraProjectKey Clave del proyecto (p. ej. `SCRUM`).
   * @returns El proyecto, o `null` si no existe.
   */
  getJiraProject(jiraProjectKey: string): JiraProject | null {
    const r = this.db.prepare("SELECT * FROM jira_projects WHERE jira_project_key = ?").get(jiraProjectKey);
    return r ? toJiraProject(r) : null;
  }

  /**
   * Lista todos los proyectos de Jira dados de alta.
   *
   * @returns Los proyectos ordenados por clave; arreglo vacío si no hay ninguno.
   */
  listJiraProjects(): JiraProject[] {
    return this.db.prepare("SELECT * FROM jira_projects ORDER BY jira_project_key").all().map(toJiraProject);
  }

  /**
   * Da de alta un proyecto o, si la clave ya existe, actualiza su nombre conservando el `id`.
   *
   * @param input Clave y nombre del proyecto.
   * @returns El proyecto guardado.
   */
  upsertJiraProject(input: { jiraProjectKey: string; jiraProjectName: string }): JiraProject {
    const r = this.db
      .prepare(
        `INSERT INTO jira_projects (jira_project_key, jira_project_name) VALUES (?, ?)
         ON CONFLICT(jira_project_key) DO UPDATE SET
           jira_project_name = excluded.jira_project_name, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
      )
      .get(input.jiraProjectKey, input.jiraProjectName);
    return toJiraProject(r!);
  }

  /**
   * Elimina un proyecto y, en cascada (`ON DELETE CASCADE`), sus repositorios.
   * No falla si la clave no existe.
   *
   * Un proyecto con historial no se puede eliminar: `ticket_logs` lo referencia sin `ON DELETE CASCADE`
   * (el historial se protege a propósito). Quien llame debe traducir ese error a un mensaje claro.
   *
   * @param jiraProjectKey Clave del proyecto a eliminar.
   * @throws Si el proyecto o alguno de sus repositorios tiene filas en `ticket_logs`
   * (`FOREIGN KEY constraint failed`); no se borra nada.
   */
  removeJiraProject(jiraProjectKey: string): void {
    this.db.prepare("DELETE FROM jira_projects WHERE jira_project_key = ?").run(jiraProjectKey);
  }

  /**
   * Da de alta un repositorio o, si ya existe `(jiraProjectId, name)`, actualiza su ruta conservando el `id`.
   *
   * @param input.defaultBaseBranch Rama base; en el alta vale `main` si se omite, y al actualizar
   * se conserva la ya guardada si se omite.
   * @returns El repositorio guardado.
   */
  upsertRepository(input: {
    jiraProjectId: number;
    name: string;
    repoLocalPath: string;
    defaultBaseBranch?: string;
  }): Repository {
    const r = this.db
      .prepare(
        `INSERT INTO repositories (jira_project_id, name, repo_local_path, default_base_branch)
         VALUES (?, ?, ?, COALESCE(?, 'main'))
         ON CONFLICT(jira_project_id, name) DO UPDATE SET
           repo_local_path = excluded.repo_local_path,
           default_base_branch = COALESCE(?, default_base_branch),
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
      )
      .get(input.jiraProjectId, input.name, input.repoLocalPath, input.defaultBaseBranch ?? null, input.defaultBaseBranch ?? null);
    return toRepository(r!);
  }

  /**
   * Registra el resultado de una ejecución: una fila por `(ticketId, repositoryId)`. Si ya existe,
   * se reemplazan todos sus campos con los del `entry` (p. ej. al reejecutar una ejecución cortada en Git).
   * `repositoryId = null` (clave sin repositorios) también se deduplica, aunque `UNIQUE` no lo haga:
   * se busca la fila con `IS` y se hace `UPDATE` o `INSERT`.
   *
   * @param entry Datos de la ejecución. Solo el Orquestador debe llamar a este método.
   * @throws Si un valor viola un `CHECK` o una clave foránea (p. ej. `jiraProjectId` inexistente).
   */
  upsertTicketLog(entry: TicketLogEntry): void {
    const values = [
      entry.jiraProjectId,
      entry.issueType,
      entry.branchType,
      entry.branchName,
      entry.baseBranch,
      entry.branchStatus,
      entry.jiraFetchStatus,
      entry.jiraFetchError ?? null,
      entry.ollamaStatus,
      entry.ollamaError ?? null,
      entry.promptVersion ?? null,
      entry.folderPath,
      entry.documentPath,
      entry.startedAt,
      entry.finishedAt ?? null,
    ];
    const existing = this.db
      .prepare("SELECT id FROM ticket_logs WHERE ticket_id = ? AND repository_id IS ?")
      .get(entry.ticketId, entry.repositoryId);
    if (existing) {
      this.db
        .prepare(
          `UPDATE ticket_logs SET jira_project_id = ?, issue_type = ?, branch_type = ?, branch_name = ?,
             base_branch = ?, branch_status = ?, jira_fetch_status = ?, jira_fetch_error = ?, ollama_status = ?,
             ollama_error = ?, prompt_version = ?, folder_path = ?, document_path = ?, started_at = ?, finished_at = ?
           WHERE id = ?`,
        )
        .run(...values, existing.id as number);
      return;
    }
    this.db
      .prepare(
        `INSERT INTO ticket_logs (jira_project_id, issue_type, branch_type, branch_name, base_branch, branch_status,
           jira_fetch_status, jira_fetch_error, ollama_status, ollama_error, prompt_version, folder_path,
           document_path, started_at, finished_at, ticket_id, repository_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...values, entry.ticketId, entry.repositoryId);
  }

  /**
   * Lista los repositorios de un proyecto.
   *
   * @param jiraProjectId `id` del proyecto.
   * @returns Los repositorios ordenados por nombre; arreglo vacío si no hay ninguno.
   */
  listRepositories(jiraProjectId: number): Repository[] {
    return this.db
      .prepare("SELECT * FROM repositories WHERE jira_project_id = ? ORDER BY name")
      .all(jiraProjectId)
      .map(toRepository);
  }

  /**
   * Elimina un repositorio. No falla si el `id` no existe.
   *
   * Un repositorio con historial no se puede eliminar: `ticket_logs` lo referencia sin `ON DELETE CASCADE`.
   *
   * @param repositoryId `id` del repositorio.
   * @throws Si el repositorio tiene filas en `ticket_logs` (`FOREIGN KEY constraint failed`).
   */
  removeRepository(repositoryId: number): void {
    this.db.prepare("DELETE FROM repositories WHERE id = ?").run(repositoryId);
  }

  /** Cierra la conexión con la base. */
  close(): void {
    this.db.close();
  }
}
