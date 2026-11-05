/**
 * Normaliza y valida la URL base de Jira que escribe el usuario.
 *
 * Solo acepta `http:` y `https:`, sin usuario ni contraseña, sin query y sin fragmento, para que las rutas de la API
 * nunca caigan dentro de un query o un fragmento ni se envíen credenciales en la URL. Jira Cloud no usa ruta, así que
 * se descarta cualquier ruta (p. ej. la que pega el navegador, `/jira/your-work`) y se devuelve solo el `origin`.
 *
 * @param value URL escrita por el usuario; se recortan los espacios.
 * @returns El `origin` normalizado (esquema y host en minúsculas, sin barra final), o `null` si la URL no es válida.
 */
export function normalizeJiraBaseUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!URL.canParse(trimmed)) return null;
  const url = new URL(trimmed);
  const isHttp = url.protocol === "http:" || url.protocol === "https:";
  if (!isHttp || url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") return null;
  return url.origin;
}
