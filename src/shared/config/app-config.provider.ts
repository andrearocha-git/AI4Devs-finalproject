import { win32 } from "node:path";
import type { AppConfig } from "../types/config.types.js";

/** Campos de `AppConfig` que gestiona la base de datos y que no forman parte de la configuración efectiva. */
type DbManagedFields = "id" | "createdAt" | "updatedAt";

/** Configuración parcial de entrada: lo que el Orquestador leyó de `app_config` o recogió al configurar. */
export type AppConfigInput = Partial<Omit<AppConfig, DbManagedFields>> & {
  /** Ruta del archivo SQLite; no vive en `app_config` porque se necesita antes de poder leerla. */
  databasePath?: string;
};

/** Configuración efectiva: todos los campos presentes y sin posibilidad de modificarse. */
export type ResolvedAppConfig = Readonly<Omit<AppConfig, DbManagedFields> & { databasePath: string }>;

/** Dependencias externas del proveedor, inyectables para poder probarlo fuera de Windows. */
export interface AppConfigProviderOptions {
  /** Variables de entorno (por defecto `process.env`); se usan `USERPROFILE` y `APPDATA`. */
  env?: Record<string, string | undefined>;
}

const SUFFIX_FORMAT = /^[A-Z0-9]+$/;

/** Recorta los espacios y trata una cadena en blanco como ausente. */
function text(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Calcula la ruta por defecto de la base de datos: `%APPDATA%\DevFlowCLI\devflow.db`.
 *
 * @param env Variables de entorno (por defecto `process.env`).
 * @returns La ruta en formato Windows.
 * @throws {Error} Si `APPDATA` no está definida o está en blanco.
 */
export function resolveDatabasePath(env: Record<string, string | undefined> = process.env): string {
  const appData = text(env.APPDATA);
  if (!appData) {
    throw new Error("No se puede calcular la ruta de la base de datos: la variable APPDATA no está definida.");
  }
  return win32.join(appData, "DevFlowCLI", "devflow.db");
}

/**
 * Valida la configuración, completa los valores por defecto y la entrega inmutable.
 *
 * Se construye una sola vez (el Orquestador) y se inyecta por constructor a los demás componentes;
 * ninguno vuelve a leer la configuración por su cuenta.
 */
export class AppConfigProvider {
  /** Configuración efectiva congelada con `Object.freeze`: modificarla lanza `TypeError`. */
  readonly config: ResolvedAppConfig;

  /**
   * @param input Configuración parcial. Obligatorios: `jiraBaseUrl`, `jiraEmail`, `jiraApiToken` y
   * `branchUserSuffix` (formato `^[A-Z0-9]+$`). Los textos se guardan sin espacios sobrantes y una cadena
   * vacía o de solo espacios cuenta como ausente (obligatorio que falta, u opcional que toma su valor por defecto).
   * @param options Entorno inyectable.
   * @throws {Error} Si falta un obligatorio, el sufijo es inválido, o no hay valor explícito ni variable de
   * entorno (`USERPROFILE`, `APPDATA`) para `ticketsRootPath` / `databasePath`. El mensaje lista todos los problemas.
   */
  constructor(input: AppConfigInput, options: AppConfigProviderOptions = {}) {
    const env = options.env ?? process.env;
    const problems: string[] = [];

    const jiraBaseUrl = text(input.jiraBaseUrl);
    const jiraEmail = text(input.jiraEmail);
    const jiraApiToken = text(input.jiraApiToken);
    const branchUserSuffix = text(input.branchUserSuffix);
    if (!jiraBaseUrl) problems.push("jiraBaseUrl es obligatorio");
    if (!jiraEmail) problems.push("jiraEmail es obligatorio");
    if (!jiraApiToken) problems.push("jiraApiToken es obligatorio");
    if (!branchUserSuffix) problems.push("branchUserSuffix es obligatorio");
    else if (!SUFFIX_FORMAT.test(branchUserSuffix)) problems.push("branchUserSuffix debe cumplir ^[A-Z0-9]+$");

    const userProfile = text(env.USERPROFILE);
    const ticketsRootPath =
      text(input.ticketsRootPath) ?? (userProfile ? win32.join(userProfile, "DevFlowCLI", "tickets") : undefined);
    if (!ticketsRootPath) problems.push("ticketsRootPath: no hay valor ni variable USERPROFILE para calcularlo");

    const databasePath = text(input.databasePath) ?? (text(env.APPDATA) ? resolveDatabasePath(env) : undefined);
    if (!databasePath) problems.push("databasePath: no hay valor ni variable APPDATA para calcularlo");

    // Las comprobaciones de valor son redundantes con `problems`, pero estrechan los tipos para el objeto final.
    if (
      problems.length > 0 ||
      !jiraBaseUrl ||
      !jiraEmail ||
      !jiraApiToken ||
      !branchUserSuffix ||
      !ticketsRootPath ||
      !databasePath
    ) {
      throw new Error(`Configuración inválida: ${problems.join("; ")}.`);
    }

    this.config = Object.freeze({
      jiraBaseUrl,
      jiraEmail,
      jiraApiToken,
      jiraTimeoutSeconds: input.jiraTimeoutSeconds ?? 10,
      ollamaHost: text(input.ollamaHost) ?? "http://localhost:11434",
      ollamaModel: text(input.ollamaModel) ?? "qwen2.5:3b",
      ollamaTimeoutSeconds: input.ollamaTimeoutSeconds ?? 120,
      branchPrefixFeature: text(input.branchPrefixFeature) ?? "features",
      branchPrefixBugfix: text(input.branchPrefixBugfix) ?? "bugs",
      branchUserSuffix,
      ticketsRootPath,
      adjuntosDirName: text(input.adjuntosDirName) ?? "adjuntos",
      databasePath,
    });
  }
}
