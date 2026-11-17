import type { TicketOrchestrator } from "../../services/orchestrator/ticket-orchestrator.js";
import type { Repository } from "../../shared/types/config.types.js";
import type { FallbackManualReason } from "../../shared/errors/result.types.js";
import type { AskCallback, AskRequest, ManualTicketAnswer, StartTicketHooks, TicketRunSummary } from "../../shared/types/ticket-run.types.js";
import { describeFailure } from "../failure-message.js";
import type { ConfirmActionsPrompt } from "../prompts/confirm-actions.prompt.js";
import type { ManualTicketEntryPrompt } from "../prompts/manual-ticket-entry.prompt.js";
import type { ProgressView } from "../views/progress-view.js";
import { createSummaryView, formatSummary } from "../views/summary-view.js";
import type { RepositorySelectionPrompt } from "../prompts/repository-selection.prompt.js";
import type { TicketSelectionPrompt } from "../prompts/ticket-selection.prompt.js";
import { isValidTicketId } from "../validators.js";

/** Lo que `devflow start` necesita del Orquestador. */
export type StartOrchestrator = Pick<
  TicketOrchestrator,
  "listProjects" | "listAssignedTickets" | "listRepositoriesForTicket" | "startTicket"
>;

/** Prompts de selección de `devflow start`. */
export interface StartPrompts {
  ticketSelection: TicketSelectionPrompt;
  repositorySelection: RepositorySelectionPrompt;
}

/** Dependencias de {@link runStart}, inyectables para probarlo sin terminal. */
export interface StartDeps {
  orchestrator: StartOrchestrator;
  prompts: StartPrompts;
  /** Ganchos de progreso y preguntas que recibe `startTicket`. */
  hooks: StartTicketHooks;
  /** Escribe una línea de salida (en la CLI, `console.log`). */
  out: (line: string) => void;
}

/** Opciones de la línea de comandos de `devflow start`. */
export interface StartOptions {
  /** `--base <rama>`: rama base solo para esta ejecución. */
  base?: string;
  /** `--reprocesar`: vuelve a generar la Fase 1 con Ollama. */
  reprocesar?: boolean;
}

/**
 * `devflow start [ID] [--base <rama>] [--reprocesar]`: resuelve todo lo previo a `startTicket` (ID, ticket, repositorio).
 *
 * Valida el formato del ID antes de tocar al Orquestador y avisa si no hay ninguna clave de proyecto configurada. Al terminar
 * muestra la pantalla de resultado (éxito, avisos o cancelación) por `out`.
 *
 * @param deps Orquestador, prompts, ganchos y salida.
 * @param ticketId ID escrito en la línea de comandos; `undefined` si no se dio.
 * @param options Opciones `--base` y `--reprocesar`.
 * @returns El resumen de `startTicket`, o `undefined` si no se llegó a iniciar el flujo.
 * @throws Error con un mensaje para el usuario si el ID es inválido, no hay claves, la clave del ticket no está
 * configurada, Jira falla o `startTicket` devuelve un resumen `blocked` (se lanza su pantalla de bloqueo: encabezado del tipo y
 * mensaje del Orquestador). El programa lo muestra por stderr y fija el código de salida 1.
 */
export async function runStart(deps: StartDeps, ticketId: string | undefined, options: StartOptions): Promise<TicketRunSummary | undefined> {
  const { orchestrator } = deps;
  if (ticketId !== undefined && !isValidTicketId(ticketId)) {
    throw new Error(`«${ticketId}» no es un ID de ticket válido (se espera, p. ej., SCRUM-12).`);
  }
  if (orchestrator.listProjects().length === 0) {
    throw new Error("Primero configura una clave de proyecto de Jira con «devflow config proyectos».");
  }
  if (ticketId === undefined) {
    const chosen = await chooseAssignedTicket(deps);
    if (chosen === undefined) return undefined;
    ticketId = chosen;
  }

  const repositories = orchestrator.listRepositoriesForTicket(ticketId);
  if (repositories.kind !== "Ok") throw new Error(describeFailure(repositories));

  const repositoryId = await chooseRepository(deps, repositories.value);
  const summary = await orchestrator.startTicket(
    {
      ticketId,
      ...(repositoryId !== undefined ? { repositoryId } : {}),
      ...(options.base !== undefined ? { baseBranchOverride: options.base } : {}),
      ...(options.reprocesar ? { reprocessFase1: true } : {}),
    },
    deps.hooks,
  );
  if (summary.blocked) throw new Error(formatSummary(summary).join("\n"));
  createSummaryView(deps.out).render(summary);
  return summary;
}

/**
 * Decide el repositorio de la ejecución: pregunta si hay varios, preselecciona si hay uno y no elige si no hay ninguno.
 *
 * @returns El `id` del repositorio, o `undefined` si la clave no tiene repositorios (solo se genera el documento).
 */
async function chooseRepository(deps: StartDeps, repositories: Repository[]): Promise<number | undefined> {
  if (repositories.length === 0) return undefined;
  if (repositories.length === 1) return repositories[0]?.id;
  return deps.prompts.repositorySelection.ask(
    repositories.map(({ id, name, repoLocalPath }) => ({ id, name, repoLocalPath })),
  );
}

/**
 * Pide al Orquestador los tickets asignados y hace elegir uno.
 *
 * @returns El ID elegido, o `undefined` (tras informarlo por `out`) si no hay tickets asignados.
 * @throws Error con el motivo en español si Jira o la configuración fallan.
 */
async function chooseAssignedTicket(deps: StartDeps): Promise<string | undefined> {
  const assigned = await deps.orchestrator.listAssignedTickets();
  if (assigned.kind !== "Ok") throw new Error(describeFailure(assigned));
  if (assigned.value.length === 0) {
    deps.out("No tienes tickets asignados en las claves de proyecto configuradas.");
    return undefined;
  }
  return deps.prompts.ticketSelection.ask(assigned.value);
}

/** Prompts con los que el Orquestador pregunta durante el flujo (`ask`). */
export interface AskPrompts {
  manualTicketEntry: ManualTicketEntryPrompt;
  confirmActions: ConfirmActionsPrompt;
}

/** Tipo de issue que se envía al Orquestador cuando la persona marca el ticket manual como bug. */
const MANUAL_BUG_TYPE = "Bug";

/** Explica por qué se pide el ticket a mano; el de `invalid_token` nunca dice que el ticket no existe. */
function describeManualReason(ticketId: string, reason: FallbackManualReason): string {
  switch (reason) {
    case "network_timeout":
      return `Jira no respondió al pedir ${ticketId}. Revisa tu conexión; puedes cargar el ticket a mano para continuar.`;
    case "invalid_token":
      return `Jira rechazó el email o el API Token (revísalos con «devflow config»). Carga ${ticketId} a mano para continuar.`;
    case "not_found":
      return `Jira no encontró el ticket ${ticketId}. Si existe, cárgalo a mano para continuar.`;
  }
}

/**
 * Arma el callback `ask` de `startTicket` con los prompts de la TUI.
 *
 * Para `confirmActions` devuelve tal cual la respuesta del prompt. Para `manualTicket` explica el motivo del fallo de Jira por `out` antes de abrir el prompt y traduce «es un bug» al tipo
 * `Bug` del Orquestador (sin `issueType` si no lo es). No captura errores: un Ctrl+C en un prompt se propaga para que el
 * programa salga con el código 130.
 *
 * @param prompts Prompts de carga manual y de confirmación.
 * @param out Escribe una línea de salida.
 * @returns El callback que se entrega a `startTicket` como `hooks.ask`.
 */
export function createAskCallback(prompts: AskPrompts, out: (line: string) => void): AskCallback {
  const ask = async (request: AskRequest): Promise<ManualTicketAnswer | boolean> => {
    if (request.kind === "manualTicket") {
      out(describeManualReason(request.ticketId, request.reason));
      const { title, description, isBug } = await prompts.manualTicketEntry.ask();
      return { title, description, ...(isBug ? { issueType: MANUAL_BUG_TYPE } : {}) };
    }
    return prompts.confirmActions.ask(request.summary);
  };
  return ask as unknown as AskCallback;
}

/**
 * Envuelve el `ask` de `startTicket` para que la vista de progreso no pise los prompts.
 *
 * Pausa el progreso antes de preguntar y lo reanuda después; si la persona no confirma (`confirmActions` devuelve `false`),
 * lo cancela para que no se muestre más progreso. Si el prompt falla (p. ej. Ctrl+C) propaga el error sin reanudar: quien
 * creó la vista debe llamar a `stop()`.
 *
 * @param ask Callback `ask` ya armado con los prompts.
 * @param progress Vista de progreso a coordinar.
 * @returns Un callback `ask` con el mismo contrato que `ask`.
 */
export function withProgressPause(ask: AskCallback, progress: Pick<ProgressView, "pause" | "resume" | "cancel">): AskCallback {
  const wrapped = async (request: AskRequest): Promise<ManualTicketAnswer | boolean> => {
    progress.pause();
    const answer = await (ask as unknown as (request: AskRequest) => Promise<ManualTicketAnswer | boolean>)(request);
    if (request.kind === "confirmActions" && answer === false) progress.cancel();
    else progress.resume();
    return answer;
  };
  return wrapped as unknown as AskCallback;
}
