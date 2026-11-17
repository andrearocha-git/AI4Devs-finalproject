/** Motivos por los que Jira no pudo entregar el ticket y se pide cargarlo a mano. */
export type FallbackManualReason = "network_timeout" | "invalid_token" | "not_found";

/** Subtipos de error que detienen el flujo del ticket. */
export type ErrorBloqueanteSubtype =
  | "RepositorioNoEncontrado"
  | "CambiosPendientes"
  /** La rama del ticket no existe en local pero sí en `origin`: la herramienta no la trae ni la crea; el usuario la configura a mano. */
  | "RamaExistenteEnRemoto"
  | "PullFallido"
  | "TipoIssueBloqueado"
  | "PermisosInsuficientes"
  | "ErrorInesperado";

/**
 * Contrato de resultado de todo paso orquestado (Jira, Git, FileSystem, Ollama).
 *
 * Se discrimina por `kind`:
 * - `Ok`: el paso terminó y entrega `value`.
 * - `FallbackManual`: Jira no respondió; el flujo continúa pidiendo los datos al usuario.
 * - `FallbackDeterminista`: Ollama falló; `rawText` es el texto crudo del ticket para el documento.
 * - `ErrorBloqueante`: el flujo se detiene; `message` es apto para mostrar al usuario.
 *
 * Una falla de integración nunca debe llegar a la TUI como excepción cruda.
 */
export type StepResult<T> =
  | { kind: "Ok"; value: T }
  | { kind: "FallbackManual"; reason: FallbackManualReason }
  | { kind: "FallbackDeterminista"; rawText: string }
  | { kind: "ErrorBloqueante"; subtype: ErrorBloqueanteSubtype; message: string };
