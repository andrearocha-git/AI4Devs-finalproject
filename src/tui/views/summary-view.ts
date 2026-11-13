import type { TicketRunSummary } from "../../shared/types/ticket-run.types.js";

/** Pantalla de resultado de `devflow start`. */
export interface SummaryView {
  /**
   * Escribe la pantalla de un resumen (éxito, cancelación o bloqueo).
   *
   * @param summary Resumen que devuelve `startTicket`.
   */
  render(summary: TicketRunSummary): void;
}

/** Encabezado de cada tipo de bloqueo; cualquier otro (error inesperado, permisos…) usa {@link GENERIC_BLOCKED_HEADING}. */
const BLOCKED_HEADINGS: Record<string, string> = {
  RepositorioNoEncontrado: "⛔ Repositorio no encontrado",
  CambiosPendientes: "⛔ El repositorio tiene cambios pendientes",
  RamaExistenteEnRemoto: "⛔ La rama solo existe en origin",
  PullFallido: "⛔ No se pudo actualizar la rama base",
  TipoIssueBloqueado: "⛔ Tipo de ticket sin plantilla",
};
const GENERIC_BLOCKED_HEADING = "⛔ No se pudo continuar";

/**
 * Arma las líneas de la pantalla de resultado de una ejecución de `startTicket`.
 *
 * Distingue el éxito, los bloqueos (un encabezado propio de cada tipo seguido del mensaje del Orquestador, con la lista de
 * archivos si la hay; nunca una línea de éxito), los avisos (Ollama en fallback, análisis reutilizado, datos cargados a mano, rama ya existente, clave
 * sin repositorios) y la cancelación. Un ticket cargado a mano sin tipo muestra solo el ID, sin paréntesis vacíos.
 *
 * @param summary Resumen que devuelve `startTicket`.
 * @returns Las líneas a mostrar, sin saltos de línea finales.
 */
export function formatSummary(summary: TicketRunSummary): string[] {
  if (summary.blocked) {
    return [BLOCKED_HEADINGS[summary.blocked.subtype] ?? GENERIC_BLOCKED_HEADING, summary.blocked.message];
  }
  if (summary.cancelled) return ["Ejecución cancelada: no se creó nada."];

  const type = summary.issueType.trim();
  const lines = [`✔ Ticket ${summary.ticketId}${type === "" ? "" : ` (${type})`} listo para trabajar`];
  if (summary.branchName !== null) {
    const existed = summary.branchStatus === "already_existed" ? " (ya existía; se usó la misma)" : "";
    lines.push(`  Rama:      ${summary.branchName}${existed}`);
  } else {
    lines.push("  Solo se generó el documento: la clave no tiene repositorios.");
  }
  if (summary.folderPath !== null) lines.push(`  Carpeta:   ${summary.folderPath}`);
  if (summary.documentPath !== null) lines.push(`  Documento: ${summary.documentPath}`);

  if (summary.jiraFetchStatus === "fallback_manual") lines.push("ℹ Datos del ticket cargados a mano (Jira no estaba disponible).");
  if (summary.ollamaStatus === "fallback_deterministic") {
    lines.push("⚠️ Generado sin Ollama: el documento tiene su estructura pero sin redactar; completa la Fase 1 a mano.");
  } else if (summary.ollamaStatus === "reused") {
    lines.push("ℹ Se reutilizó el análisis del ticket (Fase 1 ya guardada).");
  }
  return lines;
}

/**
 * Crea la vista de resumen sobre una función de salida.
 *
 * @param out Escribe una línea de salida (en la CLI, `console.log`).
 * @returns La vista; `render` escribe las líneas de {@link formatSummary}.
 */
export function createSummaryView(out: (line: string) => void): SummaryView {
  return { render: (summary) => formatSummary(summary).forEach(out) };
}
