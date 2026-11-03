/** Datos mínimos de un ticket, vengan de Jira o cargados a mano tras un `FallbackManual`. */
export interface ContextoTicket {
  ticketId: string;
  title: string;
  /** Descripción en texto plano (API v2 de Jira); puede ser cadena vacía. */
  description: string;
  /** Tipo de issue de Jira tal cual (`Bug`, `Historia`…). */
  issueType: string;
  source: "jira" | "manual";
}
