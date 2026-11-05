# Change: TK-02g — Orquestador: gestión de configuración, proyectos y repositorios para la TUI

- **Estado:** Implementado
- **Fuente:** `docs/006-tickets-de-trabajo.md` (TK-02g)
- **Depende de:** TK-02b (Jira, hecho), TK-02c (Git, hecho). Usa también TK-01 (`SQLiteStorageManager`) y TK-02a (`StepResult`, `AppConfig`).
- **INVEST:** Cumple (I, S y T evaluadas). Nota sobre S: 3 criterios técnicos pero ~14 métodos; todos son delgados (validar fuera → persistir → traducir error). Se reparte en 3 escenarios y 4 tareas. Si crece al implementar, separar «proyectos» de «repositorios», como prevé el backlog.

## Propósito

Primera parte del Orquestador (`TicketOrchestrator`): los métodos que la TUI usa fuera de `startTicket` para configurar la herramienta (sufijo de usuario, claves de proyecto, repositorios) y listar los tickets asignados. La TUI no toca Jira, Git ni SQLite; el alta solo persiste si la validación externa devuelve `Ok`, y el borrado con historial da un mensaje claro en lugar del error crudo de SQLite.

## Criterios de aceptación de origen

- CA1: `addProject` y `addRepository` solo persisten si la validación externa devuelve `Ok`; ante `FallbackManual` o `ErrorBloqueante` no escriben nada y devuelven el resultado.
- CA2: `listRepositoriesForTicket` con una clave no configurada devuelve un error con las claves disponibles, sin llamar a Jira.
- CA3: `removeProject` / `removeRepository` con historial en `ticket_logs` lanzan o devuelven un error con un mensaje claro, no el texto crudo de SQLite.
- DoD-a: la TUI (TK-03a) puede cubrir todo US-01 usando solo estos métodos.
- DoD-b: revisión de código aprobada y mergeada (se tilda tras la merge; no es un escenario).

Los métodos sin criterio numerado (`listAssignedTickets`, `suggestBranchSuffix`, `getConfig`, `saveConfig`, `listProjects`) se cubren en E3 con el comportamiento de su firma y de US-01 CA4 *(asumido: el ticket advierte que los CA se derivaron del contrato de la TUI)*.

## Escenarios BDD

### E1 — Alta, listado y baja de claves de proyecto (cubre: CA1, CA3, DoD-a)

- **Given** un `SQLiteStorageManager` en memoria con la configuración de Jira guardada, un `JiraRestClient` simulado y un proyecto con historial en `ticket_logs`
- **When** se ejecuta `addProject` con una clave válida (en minúsculas), con una clave que Jira no conoce (`not_found`), con un token inválido (`invalid_token`) y con Jira caído (`network_timeout`); luego `listProjects`, y `removeProject` sobre un proyecto sin historial y sobre el que lo tiene
- **Then** con `Ok` persiste la clave normalizada en mayúsculas con el nombre que devolvió Jira y devuelve `Ok(JiraProject)`; en los otros tres casos devuelve el `FallbackManual` tal cual y no escribe nada en `jira_projects`; `listProjects` devuelve los proyectos guardados; `removeProject` borra el que no tiene historial y, con historial, lanza un error cuyo `message` explica que el proyecto tiene tickets registrados y no puede quitarse (no contiene `FOREIGN KEY constraint failed`) dejando el proyecto intacto

### E2 — Alta, edición, baja y listado de repositorios (cubre: CA1, CA2, CA3, DoD-a)

- **Given** un proyecto `SCRUM` dado de alta, un `GitManager` simulado y un repositorio con historial en `ticket_logs`
- **When** se ejecuta `addRepository` con y sin `defaultBaseBranch`, con una ruta que `validateRepository` rechaza (`RepositorioNoEncontrado`) y con una clave de proyecto no configurada; `updateRepository` con una nueva ruta o rama base; `removeRepository` sobre un repositorio sin historial y sobre el que lo tiene; y `listRepositoriesForTicket` con `SCRUM-12`, con `OTRO-1` (clave no configurada) y con un ID mal formado
- **Then** con `Ok` persiste el repositorio y lo devuelve (sin `defaultBaseBranch` valida y guarda `main`); con la validación rechazada devuelve el `ErrorBloqueante` de Git tal cual y no escribe nada; con una clave no configurada devuelve `ErrorBloqueante` con las claves disponibles en el `message`, sin llamar a Git; `updateRepository` vuelve a validar y conserva el `id`; `removeRepository` borra el que no tiene historial y, con historial, lanza un error claro (sin el texto crudo de SQLite) dejándolo intacto; `listRepositoriesForTicket` deriva la clave del ID (`SCRUM-12` → `SCRUM`), devuelve `Ok(Repository[])` (vacío si el proyecto no tiene repositorios) y, con una clave no configurada o un ID mal formado, devuelve `ErrorBloqueante` con las claves disponibles **sin llamar a Jira**

### E3 — Configuración, sufijo sugerido y tickets asignados (cubre: US-01 CA4 en servicio; sin CA numerado en el ticket)

- **Given** un storage sin configuración y otro con ella, y un `JiraRestClient` simulado
- **When** se ejecuta `getConfig` y `saveConfig` (parcial, dos veces), `suggestBranchSuffix` con `displayName` «Andrea Rocha», con uno con acentos o varias palabras, y con Jira caído; y `listAssignedTickets` con dos proyectos dados de alta, sin proyectos y sin configuración de Jira
- **Then** `getConfig` devuelve `null` sin configuración y luego lo guardado; `saveConfig` persiste los campos dados y conserva los demás; `suggestBranchSuffix` devuelve `Ok` con la inicial del nombre más el último apellido, en mayúsculas y sin acentos, que cumple `^[A-Z0-9]+$` («Andrea Rocha» → `AROCHA`, «Pedro Gómez» → `PGOMEZ`; un nombre de una sola palabra se usa completo) o el fallo de Jira tal cual; `saveConfig` acepta cualquier sufijo que cumpla ese formato (el usuario puede poner el suyo) y rechaza el que no; `listAssignedTickets` pasa a Jira las claves guardadas y devuelve su resultado, con una lista vacía devuelve `Ok([])` sin llamar a Jira, y sin configuración de Jira devuelve `ErrorBloqueante('ErrorInesperado')` que indica ejecutar `devflow config`, sin intentar la llamada

## Trazabilidad

| Escenario | Criterios cubiertos | Test | Estado |
|---|---|---|---|
| E1 | CA1, CA3, DoD-a | `tests/unit/services/orchestrator/ticket-orchestrator.config.test.ts` › «E1 — proyectos» (10 casos: alta con `Ok`, 4 fallos de Jira sin escribir, sin configuración, listado, baja sin y con historial, error ajeno relanzado) | Hecho |
| E2 | CA1, CA2, CA3, DoD-a | `tests/unit/services/orchestrator/ticket-orchestrator.config.test.ts` › «E2 — repositorios» (18 casos: alta con y sin rama base, clave en minúsculas, validación de Git rechazada, clave no configurada, 4 de `updateRepository`, baja sin y con historial, error ajeno relanzado, 4 de `listRepositoriesForTicket`) | Hecho |
| E3 | US-01 CA4 (servicio), DoD-a | `tests/unit/services/orchestrator/ticket-orchestrator.config.test.ts` › «E3 — configuración, sufijo sugerido y tickets asignados» (17 casos: `getConfig`/`saveConfig` con 4 sufijos inválidos, 5 nombres → sufijo, fallo de Jira, nombre sin A-Z0-9, sin configuración, `listAssignedTickets` con claves, sin proyectos y sin configuración) | Hecho |

DoD-b (revisión mergeada) no es un escenario: se tilda tras la merge.

## Prerrequisitos

- Scaffold, `SQLiteStorageManager` (`upsertJiraProject`, `upsertRepository`, `listRepositories`, `removeX`, `getAppConfig`, `upsertAppConfig`), `JiraRestClient` (`validateProjectKey`, `listAssignedTickets`, `getMyDisplayName`) y `GitManager.validateRepository`: **existen**, verificado en `src/`.
- `src/services/orchestrator/ticket-orchestrator.ts` **no existe** (solo `issue-type-resolver.ts`): este ticket crea la clase. TK-02f añadirá `startTicket` en ella.
- Sin dependencias nuevas ni cambios en `package.json`, `templates/` ni configuración.

## Archivos afectados

| Ruta | Acción |
|---|---|
| `src/services/orchestrator/ticket-orchestrator.ts` | Crear (propuesta): clase con constructor `(storage, gitManager, createJiraClient)` *(asumido, ver decisiones)* y los métodos de gestión |
| `tests/unit/services/orchestrator/ticket-orchestrator.config.test.ts` | Crear (propuesta): E1, E2 y E3 con SQLite en memoria y Jira/Git simulados |

## Tareas

- [x] 1. RED/GREEN E1: esqueleto de `TicketOrchestrator` y proyectos (`listProjects`, `addProject`, `removeProject`, traducción del error de clave foránea).
- [x] 2. RED/GREEN E2: repositorios (`addRepository`, `updateRepository`, `removeRepository`, `listRepositoriesForTicket`).
- [x] 3. RED/GREEN E3: `getConfig`, `saveConfig`, `suggestBranchSuffix`, `listAssignedTickets`.
- [x] 4. Refactor, TSDoc en español de cada export, `npm run typecheck`, `npm run lint` y `npm test`.

## Decisiones y desvíos

*Sin registros. Puntos **(ambiguos/asumidos)** por confirmar antes de aprobar:*

1. *(asumido)* **Cliente de Jira bajo demanda:** el constructor recibe una fábrica `createJiraClient(config: AppConfig)` y cada método que llama a Jira lee `getAppConfig()` en ese momento. Así `saveConfig` surte efecto sin reinstanciar y los tests inyectan un cliente simulado. Sin configuración → `ErrorBloqueante('ErrorInesperado')`.
2. *(ambiguo)* **CA3 «lanzan o devuelven»:** como las firmas del ticket son `void`, se **lanza** un `Error` con mensaje en español (la TUI lo captura). Alternativa: devolver `StepResult`, que cambia las firmas.
3. *(ambiguo)* **`updateRepository(...)`:** el ticket no define sus parámetros. Se asume `{ jiraProjectKey, name, repoLocalPath, defaultBaseBranch? }` (la misma entrada que `addRepository`), apoyado en el `upsertRepository` que ya identifica por `(proyecto, nombre)`; no permite renombrar.
4. *(asumido)* **`suggestBranchSuffix`:** inicial del nombre + último apellido del `displayName`, en mayúsculas y sin acentos (`AROCHA`, `PGOMEZ`). Es solo una sugerencia: el sufijo es configurable por cada desarrollador y se guarda en `app_config.branchUserSuffix`; el formato válido es `^[A-Z0-9]+$`. *(Si `saveConfig` ya valida el formato vía `AppConfigProvider`, se reutiliza; se confirma al implementar.)*
5. *(asumido)* **Validación de `baseUrl`/`jiraBaseUrl`** (hallazgo heredado de Cursor, PR #2): **fuera de este cambio**; se aborda en TK-03a, que es donde se captura el valor. Si prefieres hacerlo aquí (en `saveConfig`), añade un escenario.
6. *(asumido)* **Módulo único:** se usa `ticket-orchestrator.ts` en lugar de un módulo separado; si crece con `startTicket` (TK-02f) se extrae en ese ticket.

### Registro de la implementación (2026-11-05)

Los puntos 1 a 6 anteriores quedaron aprobados con el contrato. Decisiones tomadas al implementar, dentro del alcance aprobado:

- `updateRepository` sobre un repositorio que no existe en el proyecto devuelve `ErrorBloqueante('RepositorioNoEncontrado')` sin llamar a Git (no lo trata como alta nueva).
- `removeRepository` nombra el repositorio como `#id`, porque su firma solo recibe el `id`.
- `suggestBranchSuffix`: si el nombre no deja caracteres `A-Z0-9` (p. ej. alfabeto no latino) devuelve `ErrorBloqueante('ErrorInesperado')` pidiendo escribirlo a mano. «María José de la Peña» → `MPENA`.
- `saveConfig` valida el sufijo con su propia expresión `^[A-Z0-9]+$` (la de `AppConfigProvider` no es reutilizable sin construir una configuración completa); un sufijo inválido lanza `Error` y no guarda nada.
- `listAssignedTickets` comprueba la configuración de Jira antes que la lista de proyectos: sin configuración devuelve error aun sin proyectos.
- Se exportan `JiraGateway`, `JiraClientFactory` y `RepositoryInput` (esta última evita repetir la entrada de `addRepository` y `updateRepository`).
- Refactor: la traducción del error de clave foránea quedó en un único helper (`removeKeepingHistory`).
- Verificación al cierre: `typecheck` y `lint` limpios; 327 tests en verde (45 de este ticket).
