import { confirm, input } from "@inquirer/prompts";
import { required } from "../validators.js";

/** Lo que la persona escribe cuando Jira no puede entregar el ticket. */
export interface ManualTicketEntry {
  title: string;
  /** Puede quedar vacía: un ticket sin descripción es un caso normal para el posprocesado. */
  description: string;
  /** `true` si la persona indicó que el ticket es un bug (elige la plantilla `bug`). */
  isBug: boolean;
}

/** Prompt de carga manual del ticket. Es una interfaz para poder simularla en los tests. */
export interface ManualTicketEntryPrompt {
  /**
   * Pide el título, la descripción y si el ticket es un bug.
   *
   * @returns Los datos escritos; el título nunca llega en blanco.
   */
  ask(): Promise<ManualTicketEntry>;
}

/**
 * Prompt real sobre `@inquirer/prompts`. Adaptador fino: solo exige el título y no decide nada sobre el tipo.
 *
 * @returns Una implementación interactiva de {@link ManualTicketEntryPrompt}.
 */
export function createManualTicketEntryPrompt(): ManualTicketEntryPrompt {
  return {
    ask: async () => {
      const title = await input({ message: "Título del ticket:", validate: required("El título") });
      const description = await input({ message: "Descripción (puede quedar vacía):" });
      const isBug = await confirm({ message: "¿Es un bug?", default: false });
      return { title: title.trim(), description: description.trim(), isBug };
    },
  };
}
