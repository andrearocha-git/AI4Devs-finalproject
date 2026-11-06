import type { FallbackManualReason } from "../errors/result.types.js";

/** Paso del flujo `startTicket` que emite eventos de progreso. */
export type StepName = "jira" | "git" | "filesystem" | "ollama";

/** Estado de un paso: `fallback` cuando el paso no pudo hacerse bien pero el flujo continúa (Jira a mano, Ollama sin redactar). */
export type StepStatus = "started" | "ok" | "fallback" | "error";

/** Entrada de `TicketOrchestrator.startTicket`. */
export interface StartTicketInput {
  /** ID del ticket (p. ej. `SCRUM-12`); de él sale la clave del proyecto. */
  ticketId: string;
  /** Repositorio elegido por la TUI; se omite solo si la clave no tiene repositorios. */
  repositoryId?: number;
  /** Rama base solo para esta ejecución (`--base`); no cambia la del repositorio. */
  baseBranchOverride?: string;
  /**
   * Reprocesar la Fase 1 (`--reprocesar`): vuelve a llamar a Ollama aunque ya haya una Fase 1 válida, sobrescribe `fase1.json` y
   * reemplaza solo el bloque de Fase 1 del documento (el encabezado y la Fase 2 no se tocan). Si el nuevo intento cae a fallback,
   * se conserva la Fase 1 anterior. También viaja en el resumen de la confirmación.
   */
  reprocessFase1?: boolean;
}

/** Lo que la TUI muestra al pedir la confirmación única, antes de cualquier escritura. */
export interface ConfirmSummary {
  ticketId: string;
  issueType: string;
  /** `null` si la clave no tiene repositorios (solo se genera el documento). */
  repositoryName: string | null;
  branchName: string | null;
  baseBranch: string | null;
  /** Carpeta del ticket y repositorio que se va a crear. */
  folderPath: string;
  /** `true` si la rama ya existe en local: la confirmación consulta si se usa la misma. */
  branchAlreadyExists: boolean;
  reprocessFase1: boolean;
}

/** Lo que el Orquestador le pide a la TUI durante el flujo. */
export type AskRequest =
  | { kind: "manualTicket"; ticketId: string; reason: FallbackManualReason }
  | { kind: "confirmActions"; summary: ConfirmSummary };

/** Datos del ticket que la persona escribe cuando Jira no responde. */
export interface ManualTicketAnswer {
  title: string;
  description: string;
}

/**
 * Único punto en el que el Orquestador pide algo al usuario durante un flujo: los datos del ticket cuando Jira no responde
 * (`manualTicket`) y la confirmación de acciones (`confirmActions`, `false` cancela la ejecución).
 */
export interface AskCallback {
  (request: Extract<AskRequest, { kind: "manualTicket" }>): Promise<ManualTicketAnswer>;
  (request: Extract<AskRequest, { kind: "confirmActions" }>): Promise<boolean>;
}

/** Ganchos que la TUI entrega a `startTicket`. */
export interface StartTicketHooks {
  /** Se invoca al comenzar y terminar cada paso; `detail` explica un `fallback` o un `error`. */
  onStep: (step: StepName, status: StepStatus, detail?: string) => void;
  ask: AskCallback;
}

/** Resultado de una ejecución de `startTicket`. */
export interface TicketRunSummary {
  ticketId: string;
  /** `null` si la clave no tiene repositorios. */
  repositoryId: number | null;
  issueType: string;
  branchName: string | null;
  branchStatus: "created" | "already_existed" | "pending_changes" | "error" | null;
  /** `null` si el flujo se cortó antes de crear la carpeta. */
  folderPath: string | null;
  documentPath: string | null;
  /** `null` si el flujo se cortó antes de llegar a consultar a Jira (entrada inválida, clave o repositorio no configurados). */
  jiraFetchStatus: "ok" | "fallback_manual" | null;
  ollamaStatus: "ok" | "fallback_deterministic" | "reused" | null;
  promptVersion?: string;
  /** Presente si el flujo se cortó por un error bloqueante; `message` es apto para mostrar al usuario. */
  blocked?: { subtype: string; message: string };
  /** `true` solo si la persona no confirmó: en ese caso no se creó nada ni se registró la ejecución. */
  cancelled?: true;
}
