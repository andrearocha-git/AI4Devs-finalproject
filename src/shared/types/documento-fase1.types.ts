/** Escenario de aceptación en formato Gherkin dentro de la Fase 1. */
export interface EscenarioGherkin {
  titulo: string;
  given: string;
  when: string;
  then: string;
}

/**
 * Fase 1 del documento del ticket (análisis redactado por Ollama y posprocesado). Interfaz mínima de TK-02d: solo lo que se renderiza;
 * TK-02e la completa con `presenteEnTicket`. Los campos propios de cada tipo son opcionales.
 */
export interface DocumentoFase1 {
  /** Descripción breve del ticket. */
  resumen: string;
  escenarios: EscenarioGherkin[];
  preguntasAbiertas: string[];
  /** Solo `bug`. */
  pasosParaReproducir?: string[];
  /** Solo `bug`. */
  comportamientoEsperado?: string;
  /** Solo `bug`. */
  comportamientoActual?: string;
  /** Solo `bug`. */
  entorno?: string;
  /** Solo `historia`. */
  historiaUsuario?: { como: string; quiero: string; para: string };
  /** Solo `historia`. */
  casosDeUso?: string[];
  /** `false` si esta Fase 1 salió del fallback determinista. */
  generatedByOllama: boolean;
  /** Versión del prompt y schema con la que se generó (`templates/issue-types.json`). */
  promptVersion: string;
}

/** Fase 1 del fallback determinista: el texto crudo del ticket, sin redactar. */
export interface DocumentoFase1Fallback {
  rawText: string;
}
