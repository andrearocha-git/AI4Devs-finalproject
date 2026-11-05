/**
 * Validador para un prompt de texto que no admite un valor en blanco.
 *
 * @param what Sujeto del mensaje con su artículo (p. ej. «El email», «La ruta»).
 * @returns Una función `validate` para {@link PromptOptions}: `true` si hay texto, o el motivo del rechazo.
 */
export function required(what: string): (value: string) => true | string {
  return (value) => (value.trim() === "" ? `${what} no puede estar en blanco.` : true);
}
