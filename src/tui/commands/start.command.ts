import type { TicketOrchestrator } from "../../services/orchestrator/ticket-orchestrator.js";
import type { Repository } from "../../shared/types/config.types.js";
import type { StartTicketHooks, TicketRunSummary } from "../../shared/types/ticket-run.types.js";
import { describeFailure } from "../failure-message.js";
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
 * Valida el formato del ID antes de tocar al Orquestador y avisa si no hay ninguna clave de proyecto configurada.
 *
 * @param deps Orquestador, prompts, ganchos y salida.
 * @param ticketId ID escrito en la línea de comandos; `undefined` si no se dio.
 * @param options Opciones `--base` y `--reprocesar`.
 * @returns El resumen de `startTicket`, o `undefined` si no se llegó a iniciar el flujo.
 * @throws Error con un mensaje para el usuario si el ID es inválido, no hay claves, la clave del ticket no está
 * configurada, Jira falla o `startTicket` devuelve un resumen `blocked` (se lanza su mensaje; provisional hasta
 * TK-03b3). El programa lo muestra y fija el código de salida 1.
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
  // Provisional hasta TK-03b3: sin pantallas de resultado, un corte no puede terminar en silencio y con código 0.
  if (summary.blocked) throw new Error(summary.blocked.message);
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
