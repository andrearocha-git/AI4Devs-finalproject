import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { createOrchestrator } from "../services/orchestrator/create-orchestrator.js";
import type { TicketOrchestrator } from "../services/orchestrator/ticket-orchestrator.js";
import { resolveDatabasePath } from "../shared/config/app-config.provider.js";
import { runConfigProyectos, type ProjectsOrchestrator } from "./commands/config-proyectos.command.js";
import { runConfig, type ConfigOrchestrator } from "./commands/config.command.js";
import { createAskCallback, runStart, type AskPrompts, type StartOptions, type StartOrchestrator, type StartPrompts } from "./commands/start.command.js";
import { createInquirerPrompts, type ConfigPrompts, type ProjectPrompts } from "./prompts/project-config.prompt.js";
import { createConfirmActionsPrompt } from "./prompts/confirm-actions.prompt.js";
import { createManualTicketEntryPrompt } from "./prompts/manual-ticket-entry.prompt.js";
import { createRepositorySelectionPrompt } from "./prompts/repository-selection.prompt.js";
import { createTicketSelectionPrompt } from "./prompts/ticket-selection.prompt.js";
import type { StartTicketHooks } from "../shared/types/ticket-run.types.js";

/** Manejadores de los comandos; el programa solo los registra y los invoca (la lógica vive en `commands/`). */
export interface CommandHandlers {
  /** `devflow config`: credenciales de Jira y sufijo de usuario. */
  config: () => Promise<void>;
  /** `devflow config proyectos`: claves de proyecto y repositorios. */
  configProyectos: () => Promise<void>;
  /** `devflow start [ID] [--base <rama>] [--reprocesar]`: prepara un ticket (rama, carpeta y documento). */
  start: (ticketId: string | undefined, options: StartOptions) => Promise<void>;
}

/** Opciones de salida del programa; los tests las usan para capturar la salida y evitar `process.exit`. */
export interface BuildProgramOptions {
  /** `true` hace que Commander lance un `CommanderError` en lugar de llamar a `process.exit`. */
  exitOverride?: boolean;
  /** Destino de la salida normal (ayuda, versión); por defecto `process.stdout`. */
  writeOut?: (text: string) => void;
  /** Destino de los errores; por defecto `process.stderr`. */
  writeErr?: (text: string) => void;
}

const packageVersion = (
  JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * Arma el programa de línea de comandos `devflow` con Commander, sin ejecutarlo.
 *
 * Registra `config` (con su subcomando `proyectos`) y `start`. Si un manejador lanza, el error se muestra como un mensaje en español
 * por `writeErr` y se fija `process.exitCode = 1`; nunca se propaga como excepción cruda. Si el usuario cancela un prompt
 * con Ctrl+C no se muestra nada y el código de salida es 130.
 *
 * @param handlers Manejadores de cada comando.
 * @param options Salida y salida-de-proceso inyectables (ver {@link BuildProgramOptions}).
 * @returns El programa, listo para `parseAsync`.
 */
export function buildProgram(handlers: CommandHandlers, options: BuildProgramOptions = {}): Command {
  const program = new Command("devflow");
  program.description("DevFlow CLI: prepara un ticket de Jira (rama, carpeta y documento) sin cambiar de contexto.");
  program.version(packageVersion);
  if (options.exitOverride) program.exitOverride();
  program.configureOutput({
    ...(options.writeOut ? { writeOut: options.writeOut } : {}),
    ...(options.writeErr ? { writeErr: options.writeErr } : {}),
  });
  const writeErr = options.writeErr ?? ((text: string) => process.stderr.write(text));

  const guarded = <A extends unknown[]>(handler: (...args: A) => Promise<void>) => async (...args: A): Promise<void> => {
    try {
      await handler(...args);
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") {
        process.exitCode = 130;
        return;
      }
      writeErr(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  };

  const config = program
    .command("config")
    .description("Configura Jira (URL, email, token), la carpeta de tickets y tu sufijo de rama.")
    .action(guarded(handlers.config));
  config
    .command("proyectos")
    .description("Gestiona las claves de proyecto de Jira y sus repositorios locales.")
    .action(guarded(handlers.configProyectos));
  program
    .command("start")
    .description("Prepara un ticket de Jira: crea la rama, la carpeta de evidencias y el documento.")
    .argument("[ID]", "ID del ticket (p. ej. SCRUM-12); sin él se elige de tus tickets asignados")
    .option("--base <rama>", "rama base solo para esta ejecución")
    .option("--reprocesar", "vuelve a generar el análisis de Ollama aunque ya exista")
    .action(guarded((ticketId: string | undefined, options: StartOptions) => handlers.start(ticketId, options)));
  return program;
}

/** Dependencias reales (o simuladas) con las que se arman los manejadores de los comandos. */
export interface HandlerDeps {
  /** Entrega el Orquestador; se invoca al ejecutar un comando, no al arrancar, así `--help` no abre la base. */
  getOrchestrator: () => ConfigOrchestrator & ProjectsOrchestrator;
  prompts: ConfigPrompts & ProjectPrompts;
  /** Entrega el Orquestador de `devflow start`; perezoso como `getOrchestrator`. Sin él, `start` falla con un mensaje claro. */
  getStartOrchestrator?: () => StartOrchestrator;
  /** Prompts de selección de `start`; por defecto, los reales de `@inquirer/prompts`. */
  startPrompts?: StartPrompts;
  /** Prompts de carga manual y confirmación de `start`; por defecto, los reales de `@inquirer/prompts`. */
  askPrompts?: AskPrompts;
  /** Escribe una línea de salida. */
  out: (line: string) => void;
  /** Variables de entorno (por defecto `process.env`). */
  env?: Record<string, string | undefined>;
}

/**
 * Arma los manejadores de `config`, `config proyectos` y `start` con sus dependencias.
 *
 * `start` usa un `onStep` provisional (ver `provisionalOnStep`) hasta TK-03b3 y falla con un mensaje claro si no se entregó
 * `getStartOrchestrator`.
 *
 * @param deps Orquestadores (perezosos), prompts y salida.
 * @returns Los manejadores que espera {@link buildProgram}.
 */
export function createHandlers(deps: HandlerDeps): CommandHandlers {
  const { getOrchestrator, prompts, out } = deps;
  return {
    config: () => runConfig({ orchestrator: getOrchestrator(), prompts, out, ...(deps.env ? { env: deps.env } : {}) }),
    configProyectos: () => runConfigProyectos({ orchestrator: getOrchestrator(), prompts, out }),
    start: async (ticketId, options) => {
      if (!deps.getStartOrchestrator) throw new Error("«devflow start» no está disponible en esta configuración.");
      await runStart(
        {
          orchestrator: deps.getStartOrchestrator(),
          prompts: deps.startPrompts ?? {
            ticketSelection: createTicketSelectionPrompt(),
            repositorySelection: createRepositorySelectionPrompt(),
          },
          hooks: {
            onStep: provisionalOnStep,
            ask: createAskCallback(
              deps.askPrompts ?? { manualTicketEntry: createManualTicketEntryPrompt(), confirmActions: createConfirmActionsPrompt(out) },
              out,
            ),
          },
          out,
        },
        ticketId,
        options,
      );
    },
  };
}

/** `onStep` provisional hasta TK-03b3 (spinner por paso): no muestra nada. */
const provisionalOnStep: StartTicketHooks["onStep"] = () => {};

/**
 * Punto de entrada real: abre la base en `%APPDATA%\DevFlowCLI\devflow.db` (al ejecutar un comando, no antes) y corre el programa.
 *
 * @param argv Argumentos de proceso (por defecto `process.argv`).
 */
export async function main(argv: string[] = process.argv): Promise<void> {
  let orchestrator: TicketOrchestrator | undefined;
  const handlers = createHandlers({
    getOrchestrator: () => (orchestrator ??= createOrchestrator({ databasePath: resolveDatabasePath() })),
    getStartOrchestrator: () => (orchestrator ??= createOrchestrator({ databasePath: resolveDatabasePath() })),
    prompts: createInquirerPrompts(),
    out: (line) => console.log(line),
  });
  try {
    await buildProgram(handlers).parseAsync(argv);
  } finally {
    orchestrator?.close();
  }
}

// Solo se ejecuta cuando el archivo se lanza directamente (`npm start`), no al importarlo desde los tests.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
