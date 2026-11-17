import { select } from "@inquirer/prompts";

/** Un repositorio entre los que se puede elegir. */
export interface SelectableRepository {
  id: number;
  name: string;
  repoLocalPath: string;
}

/** Prompt que hace elegir el repositorio de una ejecución. Es una interfaz para poder simularla en los tests. */
export interface RepositorySelectionPrompt {
  /**
   * Muestra los repositorios y pide elegir uno.
   *
   * @param repositories Repositorios de la clave del ticket (más de uno).
   * @returns El `id` del repositorio elegido.
   */
  ask(repositories: SelectableRepository[]): Promise<number>;
}

/**
 * Prompt real sobre `@inquirer/prompts`. Adaptador fino sin lógica propia.
 *
 * @returns Una implementación interactiva de {@link RepositorySelectionPrompt}.
 */
export function createRepositorySelectionPrompt(): RepositorySelectionPrompt {
  return {
    ask: (repositories) =>
      select({
        message: "¿En qué repositorio trabajas este ticket?",
        choices: repositories.map((r) => ({ name: `${r.name} — ${r.repoLocalPath}`, value: r.id })),
      }),
  };
}
