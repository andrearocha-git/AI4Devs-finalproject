import type { StepResult } from "../shared/errors/result.types.js";

/** Resultado de un paso que no salió bien (todo lo que no es `Ok`). */
export type Failure = Exclude<StepResult<unknown>, { kind: "Ok" }>;

/**
 * Traduce un resultado fallido del Orquestador a un mensaje en español para mostrar al usuario.
 *
 * Distingue un token inválido de un recurso inexistente: un `invalid_token` nunca se presenta como «no existe».
 * Nunca incluye el API Token ni otros secretos.
 *
 * @param failure Resultado que no es `Ok`.
 * @param notFound Texto para `not_found`, específico del contexto (p. ej. «La clave ABC no existe en Jira.»);
 * por defecto uno genérico.
 * @returns El mensaje, sin saltos de línea finales.
 */
export function describeFailure(failure: Failure, notFound = "Jira no encontró lo solicitado."): string {
  switch (failure.kind) {
    case "FallbackManual":
      if (failure.reason === "invalid_token") {
        return "Jira rechazó el email o el API Token. Revisa que sean correctos.";
      }
      if (failure.reason === "network_timeout") return "Jira no respondió. Revisa tu conexión y la URL.";
      return notFound;
    case "ErrorBloqueante":
      return failure.message;
    case "FallbackDeterminista":
      return "Respuesta inesperada de un paso que no debería generar texto.";
  }
}
