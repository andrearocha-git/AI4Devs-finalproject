import { confirm } from "@inquirer/prompts";
import type { ConfirmSummary } from "../../shared/types/ticket-run.types.js";

/** Prompt de la confirmación única de acciones. Es una interfaz para poder simularla en los tests. */
export interface ConfirmActionsPrompt {
  /**
   * Muestra el resumen de lo que se va a hacer y pregunta si se continúa.
   *
   * @param summary Ticket, repositorio, rama, base, carpeta y avisos.
   * @returns `true` si la persona confirma; `false` si cancela.
   */
  ask(summary: ConfirmSummary): Promise<boolean>;
}

/**
 * Arma las líneas de la pantalla de confirmación: qué se va a crear y dónde, en un solo bloque.
 *
 * Sin repositorio no hay rama ni base y se aclara que solo se genera el documento; con la rama ya existente avisa de que
 * se usará la misma; con `reprocessFase1` indica que se volverá a generar el análisis de Ollama.
 *
 * @param summary Resumen que entrega el Orquestador.
 * @returns Las líneas a mostrar, sin saltos de línea finales.
 */
export function formatConfirmSummary(summary: ConfirmSummary): string[] {
  const lines = [`Ticket: ${summary.ticketId} (${summary.issueType})`];
  if (summary.repositoryName !== null) {
    lines.push(`Repositorio: ${summary.repositoryName}`);
    if (summary.branchName !== null) lines.push(`Rama: ${summary.branchName}`);
    if (summary.baseBranch !== null) lines.push(`Base: ${summary.baseBranch}`);
  } else {
    lines.push("Esta clave no tiene repositorios: solo se generará el documento.");
  }
  lines.push(`Carpeta: ${summary.folderPath}`);
  if (summary.branchAlreadyExists && summary.branchName !== null) {
    lines.push(`⚠️  La rama ${summary.branchName} ya existe en tu repositorio local.`);
  }
  if (summary.reprocessFase1) {
    lines.push("Se volverá a generar el análisis de Ollama (--reprocesar); lo que ya escribiste en la Fase 2 no se toca.");
  }
  return lines;
}

/**
 * Pregunta final de la confirmación y su valor por defecto.
 *
 * Con la rama ya existente la respuesta por defecto es «no», para que usarla sea una decisión consciente; en el resto
 * de casos, Enter confirma porque la persona ya pidió iniciar el ticket.
 *
 * @param summary Resumen que entrega el Orquestador.
 * @returns El texto de la pregunta y lo que vale Enter.
 */
export function confirmQuestion(summary: ConfirmSummary): { message: string; defaultValue: boolean } {
  return summary.branchAlreadyExists
    ? { message: "¿Usar la misma rama y continuar?", defaultValue: false }
    : { message: "¿Continuar?", defaultValue: true };
}

/**
 * Prompt real sobre `@inquirer/prompts`. Adaptador fino: imprime las líneas de {@link formatConfirmSummary} y hace la pregunta.
 *
 * @param out Escribe una línea de salida.
 * @returns Una implementación interactiva de {@link ConfirmActionsPrompt}.
 */
export function createConfirmActionsPrompt(out: (line: string) => void): ConfirmActionsPrompt {
  return {
    ask: async (summary) => {
      formatConfirmSummary(summary).forEach(out);
      const { message, defaultValue } = confirmQuestion(summary);
      return confirm({ message, default: defaultValue });
    },
  };
}
