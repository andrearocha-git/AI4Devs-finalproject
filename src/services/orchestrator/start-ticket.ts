import { join } from "node:path";
import type { SQLiteStorageManager } from "../../database/sqlite-storage-manager.js";
import type { StepResult } from "../../shared/errors/result.types.js";
import type { AppConfig, JiraProject, Repository, TicketLogEntry } from "../../shared/types/config.types.js";
import type { DocumentoFase1 } from "../../shared/types/documento-fase1.types.js";
import type { ContextoTicket } from "../../shared/types/ticket-context.types.js";
import type { StartTicketHooks, StartTicketInput, TicketRunSummary } from "../../shared/types/ticket-run.types.js";
import type { FileSystemManager } from "../filesystem/filesystem-manager.js";
import type { GitManager } from "../git/git-manager.js";
import type { JiraRestClient } from "../jira/jira-rest-client.js";
import type { OllamaAITransformer } from "../ollama/ollama-ai-transformer.js";
import { promptVersionFor, resolveIssueType } from "./issue-type-resolver.js";

/** Todo lo que el flujo necesita ya resuelto: lo prepara `TicketOrchestrator.startTicket` antes de empezar. */
export interface StartTicketContext {
  /** Única vía a SQLite: el flujo solo escribe `ticket_logs` a través de ella. */
  storage: SQLiteStorageManager;
  /** Git: `inspectRepository` (solo lectura, antes de confirmar) y `createBranch` (después). Nunca `commit`, `add` ni `push`. */
  git: Pick<GitManager, "inspectRepository" | "createBranch">;
  /** Jira: el ticket y, si respondió, el nombre de la desarrolladora para el encabezado del documento. */
  jira: Pick<JiraRestClient, "fetchTicket" | "getMyDisplayName">;
  /** Carpetas del ticket, `fase1.json` y el documento. */
  fileSystem: Pick<FileSystemManager, "createTicketWorkspace" | "saveFase1" | "writeDocument">;
  /** Ollama: redacta la Fase 1; su fallo nunca bloquea el flujo. */
  transformer: Pick<OllamaAITransformer, "processContext">;
  /** Configuración vigente: prefijos y sufijo de las ramas, carpeta de tickets y URL de Jira. */
  config: AppConfig;
  /** Proyecto de Jira al que pertenece el ticket (ya validado como configurado). */
  project: JiraProject;
  /** `null` si la clave no tiene repositorios: se genera solo el documento. */
  repository: Repository | null;
  /** Reloj, para las fechas del documento y del registro. */
  now: () => Date;
}

/**
 * Resumen de una ejecución que se cortó antes de llegar a consultar a Jira (entrada inválida, clave o repositorio no configurados).
 *
 * @param ticketId ID tal como llegó.
 * @param subtype Subtipo del error bloqueante.
 * @param message Mensaje apto para mostrar al usuario.
 */
export function blockedRun(ticketId: string, subtype: string, message: string): TicketRunSummary {
  return {
    ticketId,
    repositoryId: null,
    issueType: "",
    branchName: null,
    branchStatus: null,
    folderPath: null,
    documentPath: null,
    jiraFetchStatus: null,
    ollamaStatus: null,
    blocked: { subtype, message },
  };
}

/**
 * Subtipo y mensaje de un paso que no salió `Ok`: los del `ErrorBloqueante` si lo es y, para cualquier otro resultado (que en estos
 * pasos no debería ocurrir), `ErrorInesperado` con el mensaje por defecto.
 */
function failureOf(result: StepResult<unknown>, fallbackMessage: string): { subtype: string; message: string } {
  return result.kind === "ErrorBloqueante"
    ? { subtype: result.subtype, message: result.message }
    : { subtype: "ErrorInesperado", message: fallbackMessage };
}

/** `DD/MM/AAAA` en hora local. */
function formatDate(date: Date): string {
  const two = (n: number): string => String(n).padStart(2, "0");
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * Flujo `startTicket` para un repositorio: Jira → tipo → inspección de Git → confirmación única → rama → carpeta → Ollama →
 * documento, con una fila en `ticket_logs` al terminar (o al cortarse en Git). No lanza: todo fallo se devuelve como `blocked`.
 *
 * @param ctx Dependencias ya resueltas por el Orquestador.
 * @param input Ticket, repositorio, base de esta ejecución y reproceso.
 * @param hooks Progreso por paso y el único punto en que se pregunta al usuario.
 * @returns El resumen de la ejecución; `blocked` si se cortó, `cancelled` si no se confirmó.
 */
export async function runStartTicket(
  ctx: StartTicketContext,
  input: StartTicketInput,
  hooks: StartTicketHooks,
): Promise<TicketRunSummary> {
  const { storage, git, jira, fileSystem, transformer, config, project, repository: repo } = ctx;
  const startedAt = ctx.now();
  const ticketId = input.ticketId.trim().toUpperCase();

  // 1. Jira (o carga manual).
  hooks.onStep("jira", "started");
  let ticket: ContextoTicket;
  let jiraFetchStatus: "ok" | "fallback_manual" = "ok";
  let jiraFetchError: string | undefined;
  const fetched = await jira.fetchTicket(ticketId);
  if (fetched.kind === "Ok") {
    ticket = fetched.value;
    hooks.onStep("jira", "ok");
  } else if (fetched.kind === "FallbackManual") {
    hooks.onStep("jira", "fallback", fetched.reason);
    const answer = await hooks.ask({ kind: "manualTicket", ticketId, reason: fetched.reason });
    ticket = { ticketId, title: answer.title, description: answer.description, issueType: "", source: "manual" };
    jiraFetchStatus = "fallback_manual";
    jiraFetchError = fetched.reason;
  } else {
    const failure = failureOf(fetched, "Respuesta inesperada de Jira.");
    hooks.onStep("jira", "error", failure.message);
    return blockedRun(ticketId, failure.subtype, failure.message);
  }

  // 2. Tipo de issue: una épica no tiene plantilla y corta el flujo sin rama, carpeta, documento ni registro.
  const resolved = resolveIssueType(ticket.issueType);
  if (resolved.kind !== "Ok") {
    const failure = failureOf(resolved, "Tipo de issue no reconocido.");
    return { ...blockedRun(ticketId, failure.subtype, failure.message), issueType: ticket.issueType, jiraFetchStatus };
  }
  const { tipo, branchType } = resolved.value;
  const displayName = ticket.source === "jira" ? await jira.getMyDisplayName() : null;

  const prefix = branchType === "bugfix" ? config.branchPrefixBugfix : config.branchPrefixFeature;
  const branchName = repo ? `${prefix}/${ticketId}-${config.branchUserSuffix}` : null;
  const baseOverride = input.baseBranchOverride?.trim();
  const baseBranch = repo ? (baseOverride ? baseOverride : repo.defaultBaseBranch) : null;
  const plannedFolder = repo ? join(config.ticketsRootPath, ticketId, repo.name) : join(config.ticketsRootPath, ticketId);

  let branchStatus: TicketRunSummary["branchStatus"] = null;
  let folderPath: string | null = null;
  let documentPath: string | null = null;
  let ollamaStatus: TicketRunSummary["ollamaStatus"] = null;
  let promptVersion: string | undefined;

  const summary = (extra: Partial<TicketRunSummary> = {}): TicketRunSummary => ({
    ticketId,
    repositoryId: repo?.id ?? null,
    issueType: ticket.issueType,
    branchName,
    branchStatus,
    folderPath,
    documentPath,
    jiraFetchStatus,
    ollamaStatus,
    ...(promptVersion !== undefined ? { promptVersion } : {}),
    ...extra,
  });
  const record = (): void => {
    const entry: TicketLogEntry = {
      ticketId,
      jiraProjectId: project.id,
      repositoryId: repo?.id ?? null,
      issueType: ticket.issueType,
      branchType,
      branchName,
      baseBranch,
      branchStatus,
      jiraFetchStatus,
      ...(jiraFetchError !== undefined ? { jiraFetchError } : {}),
      ollamaStatus,
      ...(promptVersion !== undefined ? { promptVersion } : {}),
      folderPath,
      documentPath,
      startedAt: startedAt.toISOString(),
      finishedAt: ctx.now().toISOString(),
    };
    storage.upsertTicketLog(entry);
  };
  const stop = (subtype: string, message: string): TicketRunSummary => {
    record();
    return summary({ blocked: { subtype, message } });
  };

  // 3. Inspección de Git (solo lectura): corta antes de pedir la confirmación.
  let branchAlreadyExists = false;
  if (repo && branchName && baseBranch) {
    hooks.onStep("git", "started");
    const inspected = await git.inspectRepository({ repoLocalPath: repo.repoLocalPath, branchName });
    if (inspected.kind !== "Ok") {
      const failure = failureOf(inspected, "No se pudo inspeccionar el repositorio.");
      branchStatus = failure.subtype === "CambiosPendientes" ? "pending_changes" : "error";
      hooks.onStep("git", "error", failure.message);
      return stop(failure.subtype, failure.message);
    }
    branchAlreadyExists = inspected.value.branchAlreadyExists;
  }

  // 4. Confirmación única, antes de cualquier escritura.
  const confirmed = await hooks.ask({
    kind: "confirmActions",
    summary: {
      ticketId,
      issueType: ticket.issueType,
      repositoryName: repo?.name ?? null,
      branchName,
      baseBranch,
      folderPath: plannedFolder,
      branchAlreadyExists,
      reprocessFase1: input.reprocessFase1 ?? false,
    },
  });
  if (!confirmed) {
    if (repo) hooks.onStep("git", "ok", "inspección completada; ejecución cancelada");
    return { ...summary({ cancelled: true }), branchName: null };
  }

  // 5. Rama.
  if (repo && branchName && baseBranch) {
    const created = await git.createBranch({ repoLocalPath: repo.repoLocalPath, branchName, baseBranch });
    if (created.kind !== "Ok") {
      const failure = failureOf(created, "No se pudo crear la rama.");
      // `createBranch` repite el `git status`: si el árbol se ensució tras la confirmación, es el mismo corte que en la inspección.
      branchStatus = failure.subtype === "CambiosPendientes" ? "pending_changes" : "error";
      hooks.onStep("git", "error", failure.message);
      return stop(failure.subtype, failure.message);
    }
    branchStatus = created.value.alreadyExisted ? "already_existed" : "created";
    hooks.onStep("git", "ok");
  }

  // 6. Carpeta.
  hooks.onStep("filesystem", "started");
  const workspace = await fileSystem.createTicketWorkspace({ ticketId, ...(repo ? { repositoryName: repo.name } : {}) });
  if (workspace.kind !== "Ok") {
    const failure = failureOf(workspace, "No se pudo crear la carpeta del ticket.");
    hooks.onStep("filesystem", "error", failure.message);
    return stop(failure.subtype, failure.message);
  }
  hooks.onStep("filesystem", "ok");

  // 7. Fase 1 con Ollama; su fallo nunca bloquea.
  hooks.onStep("ollama", "started");
  const generated: StepResult<DocumentoFase1> = await transformer.processContext(ticket, tipo);
  let fase1: DocumentoFase1 | { rawText: string };
  if (generated.kind === "Ok") {
    fase1 = generated.value;
    ollamaStatus = "ok";
    promptVersion = generated.value.promptVersion;
    await fileSystem.saveFase1(ticketId, generated.value);
    hooks.onStep("ollama", "ok");
  } else {
    fase1 = { rawText: generated.kind === "FallbackDeterminista" ? generated.rawText : `${ticket.title}\n\n${ticket.description}`.trim() };
    ollamaStatus = "fallback_deterministic";
    promptVersion = promptVersionFor(tipo);
    hooks.onStep("ollama", "fallback");
  }

  // 8. Documento.
  const written = await fileSystem.writeDocument({
    documentPath: workspace.value.documentPath,
    tipo,
    fase1,
    ...(repo && branchName ? { repo: repo.name, rama: branchName } : {}),
    encabezado: {
      ticketId,
      titulo: ticket.title,
      jiraUrl: `${config.jiraBaseUrl.replace(/\/+$/, "")}/browse/${ticketId}`,
      ...(displayName?.kind === "Ok" ? { desarrollador: displayName.value } : {}),
      fecha: formatDate(ctx.now()),
      proyecto: project.jiraProjectKey,
    },
    regenerateFase1Only: false,
  });
  if (written.kind !== "Ok") {
    const failure = failureOf(written, "No se pudo escribir el documento.");
    hooks.onStep("filesystem", "error", failure.message);
    return stop(failure.subtype, failure.message);
  }

  folderPath = workspace.value.folderPath;
  documentPath = workspace.value.documentPath;
  record();
  return summary();
}
