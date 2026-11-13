/**
 * Validador para un prompt de texto que no admite un valor en blanco.
 *
 * @param what Sujeto del mensaje con su artículo (p. ej. «El email», «La ruta»).
 * @returns Una función `validate` para {@link PromptOptions}: `true` si hay texto, o el motivo del rechazo.
 */
export function required(what: string): (value: string) => true | string {
  return (value) => (value.trim() === "" ? `${what} no puede estar en blanco.` : true);
}

/** Formato `<CLAVE>-<número>`: el mismo que acepta el Orquestador (que normaliza a mayúsculas), no uno más estricto. */
const TICKET_ID_FORMAT = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;

/**
 * Comprueba que un texto tenga forma de ID de ticket de Jira (p. ej. `SCRUM-12`) antes de llamar al Orquestador.
 *
 * Usa el mismo criterio que el Orquestador: acepta minúsculas (`scrum-2`) y claves de una sola letra (`A-1`), y
 * ignora los espacios de los extremos. Solo mira el formato; no comprueba que la clave esté configurada ni que exista en Jira.
 *
 * @param input Texto escrito por el usuario.
 * @returns `true` si el formato es válido.
 */
export function isValidTicketId(input: string): boolean {
  return TICKET_ID_FORMAT.test(input.trim());
}
