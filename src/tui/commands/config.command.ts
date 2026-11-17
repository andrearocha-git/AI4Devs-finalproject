import { defaultTicketsRoot } from "../../shared/config/app-config.provider.js";
import { normalizeJiraBaseUrl } from "../../shared/config/jira-base-url.js";
import type { TicketOrchestrator } from "../../services/orchestrator/ticket-orchestrator.js";
import { describeFailure } from "../failure-message.js";
import type { ConfigPrompts } from "../prompts/project-config.prompt.js";
import { required } from "../validators.js";

/** Lo que `devflow config` necesita del Orquestador. */
export type ConfigOrchestrator = Pick<TicketOrchestrator, "getConfig" | "saveConfig" | "suggestBranchSuffix">;

/** Dependencias de {@link runConfig}, inyectables para probarlo sin terminal. */
export interface ConfigDeps {
  orchestrator: ConfigOrchestrator;
  prompts: ConfigPrompts;
  /** Escribe una línea de salida (por defecto de la CLI, `console.log`). */
  out: (line: string) => void;
  /** Variables de entorno para calcular la carpeta de tickets por defecto (por defecto `process.env`). */
  env?: Record<string, string | undefined>;
}

const SUFFIX_FORMAT = /^[A-Z0-9]+$/;


/**
 * `devflow config`: pide las credenciales de Jira, la carpeta de tickets y el sufijo de usuario, y las guarda de una vez.
 *
 * En el primer arranque propone el sufijo a partir del nombre de la cuenta de Jira, consultándolo con las credenciales
 * recién escritas (aún sin guardar). Si Jira no puede sugerirlo, muestra el motivo y deja escribirlo a mano. Con una
 * configuración existente ofrece los valores actuales como predeterminados, y un token en blanco conserva el guardado.
 * El token nunca se escribe en la salida.
 *
 * @param deps Orquestador, prompts y salida.
 * @throws Lo que lance `saveConfig` (p. ej. URL no válida); el programa lo traduce a un mensaje y `exitCode = 1`.
 */
export async function runConfig(deps: ConfigDeps): Promise<void> {
  const { orchestrator, prompts, out } = deps;
  const existing = orchestrator.getConfig();

  const jiraBaseUrl = (
    await prompts.input("URL de Jira (https://<sitio>.atlassian.net)", {
      ...(existing ? { default: existing.jiraBaseUrl } : {}),
      validate: (value) =>
        normalizeJiraBaseUrl(value) !== null || "Escribe una URL http(s) válida, p. ej. https://equipo.atlassian.net",
    })
  ).trim();
  const jiraEmail = (
    await prompts.input("Email de tu cuenta de Jira", {
      ...(existing ? { default: existing.jiraEmail } : {}),
      validate: required("El email"),
    })
  ).trim();
  const typedToken = (
    await prompts.password(existing ? "API Token de Jira (en blanco conserva el guardado)" : "API Token de Jira", {
      validate: existing ? () => true : required("El token"),
    })
  ).trim();
  const jiraApiToken = typedToken === "" && existing ? existing.jiraApiToken : typedToken;
  const rootDefault = existing?.ticketsRootPath ?? defaultTicketsRoot(deps.env);
  const ticketsRootPath = (
    await prompts.input("Carpeta de tickets (fuera de tus repositorios)", {
      ...(rootDefault ? { default: rootDefault } : {}),
      validate: required("La carpeta"),
    })
  ).trim();

  let suffixDefault = existing?.branchUserSuffix;
  if (suffixDefault === undefined) {
    const suggestion = await orchestrator.suggestBranchSuffix({ jiraBaseUrl, jiraEmail, jiraApiToken });
    if (suggestion.kind === "Ok") {
      suffixDefault = suggestion.value;
    } else {
      out(`No se pudo sugerir el sufijo: ${describeFailure(suggestion)} Escríbelo a mano.`);
    }
  }
  const branchUserSuffix = (
    await prompts.input("Sufijo de usuario para tus ramas (p. ej. AROCHA)", {
      ...(suffixDefault !== undefined ? { default: suffixDefault } : {}),
      validate: (value) =>
        SUFFIX_FORMAT.test(value.trim()) || "Solo mayúsculas A-Z y números, sin espacios (p. ej. AROCHA).",
    })
  ).trim();

  orchestrator.saveConfig({ jiraBaseUrl, jiraEmail, jiraApiToken, ticketsRootPath, branchUserSuffix });
  out("Configuración guardada. Siguiente paso: devflow config proyectos para dar de alta tus claves y repositorios.");
}
