// Tipos compartidos de configuración y entidades (docs/006-tickets-de-trabajo.md, TK-01).

/** Configuración global de la aplicación: fila única (`app_config`, `id = 1`). */
export interface AppConfig {
  id: 1;
  jiraBaseUrl: string;
  jiraEmail: string;
  /** Token de la API de Jira, guardado en claro en el MVP (decisión H-05). */
  jiraApiToken: string;
  jiraTimeoutSeconds: number;
  ollamaHost: string;
  ollamaModel: string;
  ollamaTimeoutSeconds: number;
  branchPrefixFeature: string;
  branchPrefixBugfix: string;
  /** Sufijo de usuario de las ramas (`<prefijo>/<ID>-<SUFIJO>`). */
  branchUserSuffix: string;
  /** Carpeta raíz de los tickets, fuera de los repositorios. */
  ticketsRootPath: string;
  /** Nombre de la subcarpeta de adjuntos de cada ticket. */
  adjuntosDirName: string;
  createdAt: string;
  updatedAt: string;
}

/** Clave de proyecto de Jira dada de alta por el usuario (`jira_projects`). */
export interface JiraProject {
  id: number;
  /** Clave normalizada en mayúsculas (p. ej. `SCRUM`). */
  jiraProjectKey: string;
  jiraProjectName: string;
  createdAt: string;
  updatedAt: string;
}

/** Repositorio local asociado a un proyecto (`repositories`); un proyecto puede tener 0..N. */
export interface Repository {
  id: number;
  jiraProjectId: number;
  name: string;
  /** Ruta local del repositorio Git. */
  repoLocalPath: string;
  /** Rama desde la que nacen las ramas nuevas (por defecto `main`). */
  defaultBaseBranch: string;
  createdAt: string;
  updatedAt: string;
}

/** Resultado de una ejecución sobre un ticket y un repositorio (`ticket_logs`). */
export interface TicketLogEntry {
  ticketId: string;
  jiraProjectId: number;
  /** `null` si la clave de proyecto no tiene repositorios (solo se genera el documento). */
  repositoryId: number | null;
  /** Tipo de issue de Jira tal cual (`Error`, `Historia`…). */
  issueType: string;
  branchType: "feature" | "bugfix";
  branchName: string | null;
  baseBranch: string | null;
  /** Resultado del Git Manager; `null` sin repositorio. `pending_changes` y `error` cortan la ejecución en Git. */
  branchStatus: "created" | "already_existed" | "pending_changes" | "error" | null;
  jiraFetchStatus: "ok" | "fallback_manual";
  jiraFetchError?: string;
  /** Resultado de Ollama; `reused` si se copió la Fase 1 de otro repositorio del ticket; `null` si se cortó en Git. */
  ollamaStatus: "ok" | "fallback_deterministic" | "reused" | null;
  ollamaError?: string;
  promptVersion?: string;
  /** `null` si la ejecución se cortó en Git. */
  folderPath: string | null;
  documentPath: string | null;
  startedAt: string;
  finishedAt?: string;
}
