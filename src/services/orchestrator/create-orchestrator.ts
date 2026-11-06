import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SQLiteStorageManager } from "../../database/sqlite-storage-manager.js";
import { GitManager } from "../git/git-manager.js";
import { JiraRestClient } from "../jira/jira-rest-client.js";
import { TicketOrchestrator } from "./ticket-orchestrator.js";

/**
 * Raíz de composición: arma el Orquestador con sus dependencias reales.
 *
 * Existe para que la TUI pueda instanciar el Orquestador sin importar la base de datos ni los clientes de Jira y Git,
 * que la regla de lint de capas le prohíbe.
 *
 * Efectos secundarios: crea la carpeta de la base si no existe, abre la conexión y aplica las migraciones pendientes
 * (idempotente). La conexión queda abierta durante la vida del proceso.
 *
 * @param options.databasePath Ruta del archivo SQLite (en producción, `resolveDatabasePath()`); `:memory:` también vale.
 * @returns Un Orquestador listo para usar; el cliente de Jira se crea en cada operación con la configuración guardada.
 * @throws Si no se puede crear la carpeta o abrir la base (permisos, ruta inválida) o falla una migración.
 */
export function createOrchestrator(options: { databasePath: string }): TicketOrchestrator {
  mkdirSync(dirname(options.databasePath), { recursive: true });
  const storage = new SQLiteStorageManager(options.databasePath);
  storage.migrate();
  return new TicketOrchestrator(
    storage,
    new GitManager(),
    (config) =>
      new JiraRestClient({
        baseUrl: config.jiraBaseUrl,
        email: config.jiraEmail,
        apiToken: config.jiraApiToken,
        timeoutSeconds: config.jiraTimeoutSeconds,
      }),
  );
}
