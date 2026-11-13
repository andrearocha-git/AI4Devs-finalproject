import { select } from "@inquirer/prompts";

/** Un ticket asignado tal como lo devuelve el Orquestador. */
export interface AssignedTicket {
  ticketId: string;
  title: string;
  issueType: string;
}

/** Prompt que hace elegir un ticket de la lista de asignados. Es una interfaz para poder simularla en los tests. */
export interface TicketSelectionPrompt {
  /**
   * Muestra la lista y pide elegir un ticket.
   *
   * @param tickets Tickets asignados (al menos uno).
   * @returns El ID del ticket elegido.
   */
  ask(tickets: AssignedTicket[]): Promise<string>;
}

/**
 * Prompt real sobre `@inquirer/prompts`. Adaptador fino sin lógica propia.
 *
 * @returns Una implementación interactiva de {@link TicketSelectionPrompt}.
 */
export function createTicketSelectionPrompt(): TicketSelectionPrompt {
  return {
    ask: (tickets) =>
      select({
        message: "¿Qué ticket quieres iniciar?",
        choices: tickets.map((t) => ({ name: `${t.ticketId} · ${t.title} (${t.issueType})`, value: t.ticketId })),
      }),
  };
}
