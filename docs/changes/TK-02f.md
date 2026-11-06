# Change: TK-02f — Orquestador: flujo `startTicket` (núcleo) y registro en `ticket_logs`

- **Estado:** Implementado
- **Fuente:** `docs/006-tickets-de-trabajo.md` (TK-02f)
- **Depende de:** TK-02b, TK-02c, TK-02d, TK-02e (hechos y fusionados); usa también TK-02a (`StepResult`, `resolveIssueType`) y TK-02g (la clase `TicketOrchestrator` y su configuración).
- **INVEST:** Cumple tras la división (I, S y T evaluadas). Nota sobre S: el ticket original (con la reutilización y el reproceso de la Fase 1) reunía unos 14 comportamientos y 45 tests y falló S; el 2026-11-06 se separó esa parte en TK-02h. Lo que queda cabe en 2 escenarios y 4 tareas (unos 30 tests).

## Propósito

Une las piezas ya construidas en el flujo `startTicket`: obtiene el ticket de Jira (o lo pide a mano), resuelve su tipo, inspecciona el repositorio, pide **una sola confirmación**, crea la rama, la carpeta y el documento con la Fase 1 de Ollama, y registra una fila en `ticket_logs`. Es lo que entrega el valor central de la herramienta: un ticket listo para trabajar en un solo paso, para un repositorio por ejecución. La reutilización y el reproceso de la Fase 1 llegan en TK-02h.

## Criterios de aceptación de origen

Del criterio técnico único del ticket (CA5 original, más H-03), numerados para trazar; las partes de Fase 1 reutilizable y reprocesable pasaron a TK-02h:

- CA1: repositorio con cambios pendientes → `blocked` **sin invocar `ask({ kind: 'confirmActions' })`**, con `folderPath`/`documentPath`/`ollamaStatus` en `null` y fila en `ticket_logs` con `branch_status = 'pending_changes'`.
- CA2: confirmación rechazada → `cancelled: true`, sin llamadas de escritura a Git, FileSystem ni Ollama y **sin fila** en `ticket_logs`.
- CA3: Jira en fallback → se invoca `ask({ kind: 'manualTicket' })` y el flujo continúa con los datos devueltos.
- CA4: Jira OK + Ollama OK → rama + carpeta + documento + `fase1.json` + un único registro en `ticket_logs` con `prompt_version`.
- CA5: Jira en fallback + Ollama en fallback → el flujo completa igual, con el documento marcado `⚠️ Generado sin Ollama` y sin guardar `fase1.json`.
- CA6: épica → aviso sin rama, carpeta, documento ni registro.
- CA7: clave sin repositorios → solo documento, `repositoryId: null` y sin pasos de Git.
- CA8: rama solo en `origin` (`RamaExistenteEnRemoto`) → `blocked` **sin invocar `ask({ kind: 'confirmActions' })`**, con fila en `ticket_logs` (`branch_status = 'error'`).
- DoD-a: solo el Orquestador escribe `ticket_logs` *(lo impone la regla de lint de capas; se comprueba con `npm run lint`)*.
- DoD-b: los 4 tipos de `StepResult` (`Ok`, `FallbackManual`, `FallbackDeterminista`, `ErrorBloqueante`) tienen al menos un test en el Orquestador que los maneja.
- DoD-c: revisión de código aprobada y mergeada (se tilda tras la merge; no es un escenario).

**Fuera de este cambio (TK-02h):** `reprocessFase1` con una Fase 1 previa válida, el reproceso en fallback que conserva la Fase 1 anterior, el reintento automático si la Fase 1 previa quedó en fallback, y la segunda ejecución con otro repositorio que reutiliza la Fase 1 (`ollamaStatus: 'reused'`). En este ticket `reprocessFase1` se acepta en la entrada y viaja en el resumen de la confirmación, pero **no tiene efecto**; cada ejecución genera la Fase 1 con Ollama.

Criterios de las historias relacionadas que este ticket cubre en el servicio: **US-02** CA2 (datos del ticket sin pedir nada más), CA3 (clave no configurada, antes de llamar a Jira), CA4-5 (fallback manual) y CA6 (épica); **US-03** CA1-CA5, CA7, CA8 y CA10 (la parte de orquestación; la pantalla es de TK-03b). US-03 CA6 y CA9 son de TK-02h; US-01 CA6 y US-02 CA1 no son de este ticket.

## Escenarios BDD

### E1 — Flujo principal: Jira, tipo, rama, carpeta, documento y registro (cubre: CA3, CA4, CA5, CA6, CA7, DoD-b)

- **Given** un `TicketOrchestrator` con la configuración y un proyecto dados de alta, Jira, Git y Ollama simulados (Git con un doble que registra cada llamada), SQLite en memoria y carpetas de tickets temporales reales, y un repositorio con su rama base
- **When** se ejecuta `startTicket` con un ticket de tipo bug y otro de historia (con Jira OK y Ollama OK); con Jira en fallback (red, token inválido, ticket inexistente) y con la respuesta del usuario; con Ollama en fallback; con una épica; con una clave que no está configurada; con una clave sin repositorios; con un repositorio que no existe; y con `baseBranchOverride`
- **Then** en el camino feliz hace, en orden, `fetchTicket`, `getMyDisplayName`, `resolveIssueType`, `inspectRepository`, **una sola** `ask({ kind: 'confirmActions' })` con `{ ticketId, issueType, repositoryName, branchName, baseBranch, folderPath, branchAlreadyExists, reprocessFase1 }`, `createBranch`, `createTicketWorkspace`, `processContext`, `saveFase1` y `writeDocument` (con el encabezado: ID, título, URL de Jira, desarrollador/a, fecha `DD/MM/AAAA` y proyecto, además de `repo` y `rama`), y emite `onStep` por cada paso (`started` → `ok`, `fallback` o `error`); la rama es `<prefijo>/<ID>-<SUFIJO>` con `features` o `bugs` según el tipo y la base es la del repositorio o la del `baseBranchOverride` (que no cambia la configuración); deja **una única fila** en `ticket_logs` con `jira_fetch_status`, `ollama_status`, `branch_status = 'created'`, `prompt_version`, `folder_path`, `document_path` y las fechas, y devuelve un `TicketRunSummary` coherente; con Jira en fallback invoca `ask({ kind: 'manualTicket', reason })` con el motivo, continúa con `source: 'manual'` y registra `jira_fetch_status = 'fallback_manual'` y su motivo; con Ollama en fallback completa igual, con el documento `⚠️ Generado sin Ollama`, **sin** guardar `fase1.json` y con `ollama_status = 'fallback_deterministic'`; una épica devuelve `blocked` con `TipoIssueBloqueado` sin rama, carpeta, documento ni fila y sin pedir confirmación; una clave no configurada devuelve `blocked` con las claves disponibles **sin llamar a Jira**; una clave sin repositorios genera solo el documento (`repositoryId: null`, sin pasos de Git ni `inspectRepository`, fila con `repository_id` nulo que se actualiza —no se duplica— al repetir la ejecución); un repositorio inexistente devuelve `blocked` con `RepositorioNoEncontrado`

### E2 — Cortes en Git y confirmación única (cubre: CA1, CA2, CA8, US-03 CA2, CA3 y CA5)

- **Given** el mismo entorno, un repositorio con cambios pendientes, otro con la rama solo en `origin`, otro con la rama ya existente en local, y un repositorio donde el `pull` de la base falla
- **When** se ejecuta `startTicket` en cada caso, con `ask` aceptando y rechazando la confirmación
- **Then** con cambios pendientes devuelve `blocked` (`CambiosPendientes`, con la lista de archivos en el mensaje) **sin invocar `ask({ kind: 'confirmActions' })`**, con `folderPath`, `documentPath` y `ollamaStatus` en `null`, sin crear carpeta, documento ni llamar a Ollama, y con una fila `branch_status = 'pending_changes'`; con la rama solo en `origin` devuelve `blocked` (`RamaExistenteEnRemoto`) sin pedir confirmar y con fila `branch_status = 'error'`; con el `pull` fallido (`PullFallido` de `createBranch`, tras confirmar) devuelve `blocked`, no crea carpeta ni documento y deja fila `branch_status = 'error'`; con la rama ya existente la confirmación llega con `branchAlreadyExists: true`, y si el usuario acepta continúa con carpeta y documento, sin crear una rama duplicada (`createBranch` devuelve `alreadyExisted`, fila `branch_status = 'already_existed'`) y si rechaza la ejecución se cancela; al rechazar cualquier confirmación devuelve `cancelled: true` con `branchName`, `folderPath`, `documentPath` y `ollamaStatus` en `null`, **sin** llamar a `createBranch`, FileSystem ni Ollama y **sin fila** en `ticket_logs`; la confirmación se pide **una sola vez** por ejecución, después de `inspectRepository` y antes de cualquier escritura

## Trazabilidad

| Escenario | Criterios cubiertos | Test | Estado |
|---|---|---|---|
| E1 | CA3, CA4, CA5, CA6, CA7, DoD-b | `tests/integration/ticket-flow.e2e.test.ts` (camino feliz, Ollama caído y clave sin repositorios con todo real salvo Jira y Ollama); `tests/unit/services/orchestrator/ticket-orchestrator.start.test.ts` › «E1 — flujo principal» (24 casos: camino feliz de un bug con orden de llamadas, confirmación, rama, carpeta, documento, `fase1.json`, fila y `onStep`; historia y `baseBranchOverride`; Jira en fallback con 3 motivos, sin nombre de la desarrolladora y con error bloqueante; Ollama en fallback; épica, clave no configurada, ID mal formado, sin configuración, `repositoryId` inexistente, de otra clave o ausente; clave sin repositorios y repetición sin duplicar la fila) | Hecho |
| E2 | CA1, CA2, CA8 | `tests/unit/services/orchestrator/ticket-orchestrator.start.test.ts` › «E2 — cortes en Git y confirmación única» (12 casos: cambios pendientes con la lista de archivos y fila `pending_changes`; rama solo en `origin`, ruta que ya no es repositorio y nombre de rama no válido con fila `error`; una única confirmación entre la inspección y la rama; cancelación con y sin repositorio; rama existente aceptada y rechazada; `pull` fallido; fallo de carpeta y fallo de documento tras crear la rama); y de punta a punta con Git real, `tests/integration/ticket-flow.e2e.test.ts` (cambios pendientes y rama solo en `origin` reales, rama existente que deja el repositorio donde estaba) | Hecho |

DoD-a se comprueba con `npm run lint` (regla de capas ya existente); DoD-c (revisión mergeada) no es un escenario: se tilda tras la merge. Además de los tests unitarios, la tarea 3 añade una prueba de integración con Git real (`tests/integration/ticket-flow.e2e.test.ts`) que recorre el camino feliz; TK-02h la ampliará con el segundo repositorio.

## Prerrequisitos

- Ninguna dependencia nueva ni cambios en `package.json` ni en `templates/`.
- Verificado en `src/`: `JiraRestClient.fetchTicket` y `getMyDisplayName`, `GitManager.inspectRepository` y `createBranch`, `FileSystemManager` (`createTicketWorkspace`, `writeDocument`, `saveFase1`), `OllamaAITransformer.processContext`, `resolveIssueType`, `SQLiteStorageManager.upsertTicketLog` y `TicketLogEntry`, `AppConfig` (prefijos, sufijo, carpeta de tickets). **No existe** `tests/integration/` ni el flujo `startTicket`.
- El código de TK-02e/TK-02d ya admite todo lo que este ticket necesita; el Orquestador solo los coordina.

## Archivos afectados

| Ruta | Acción |
|---|---|
| `src/services/orchestrator/ticket-orchestrator.ts` | Modificar (existente): `startTicket`, un cuarto parámetro opcional de dependencias y `fetchTicket` en `JiraGateway` |
| `src/services/orchestrator/start-ticket.ts` | Crear (propuesta, *asumido*): el flujo en un módulo propio, para que la clase no crezca más; `startTicket` delega en él |
| `src/shared/types/ticket-run.types.ts` | Crear (propuesta, *asumido*): `StartTicketInput`, `StepName`, `StepStatus`, `AskRequest`, `AskCallback`, `TicketRunSummary` (la TUI los importa desde `shared`, no desde el Orquestador) |
| `tests/unit/services/orchestrator/ticket-orchestrator.start.test.ts` | Crear (propuesta): E1 y E2 (SQLite en memoria, carpetas temporales reales, Git, Jira y Ollama simulados) |
| `tests/integration/ticket-flow.e2e.test.ts` | Crear (propuesta): camino feliz con Git real |
| `tests/unit/services/orchestrator/ticket-orchestrator.config.test.ts` | Modificar (existente, **requiere tu autorización**): añadir `fetchTicket: vi.fn()` al doble de Jira del `setup` (decisión 2) |

## Tareas

- [x] 1. RED/GREEN E1: tipos de `startTicket`, el flujo principal, la entrada (clave, épica, Jira y fallback manual) y el registro en `ticket_logs`
- [x] 2. RED/GREEN E2: inspección de Git, confirmación única y todos los cortes (cambios pendientes, rama solo en `origin`, `pull` fallido, rama existente, cancelación)
- [x] 3. Prueba de integración con Git real (`tests/integration/ticket-flow.e2e.test.ts`) y comprobar que `createOrchestrator` ya arma el flujo con las dependencias reales
- [x] 4. Refactor, TSDoc en español de cada export, `npm run typecheck`, `npm run lint` y `npm test`; probar a mano `startTicket` contra el Jira, Ollama y un repositorio reales

## Decisiones y desvíos

*Registro de la implementación (2026-11-06) y puntos aprobados con el contrato:*

- **E1, autorizado por la desarrolladora:** `JiraGateway` incluye ahora `fetchTicket`, y se añadió `fetchTicket: vi.fn()` al doble de Jira del `setup` de `ticket-orchestrator.config.test.ts` (TK-02g), la única línea que cambió en ese test (decisión 2).
- *(asumido)* **Interpretación de «repositorio inexistente».** Se distinguen dos casos: un `repositoryId` que no existe (o es de otra clave) corta antes de llamar a Jira, sin fila; que la **ruta** deje de ser un repositorio Git (`inspectRepository` → `RepositorioNoEncontrado`) es un corte en Git y registra una fila `branch_status = 'error'`, como el resto de los cortes en Git según `docs/003`. La decisión 6 decía «repositorio inexistente: no se registra»; se refiere solo al primer caso. El segundo se cubre en E2.
- *(asumido)* **`folderPath` de la confirmación.** Se calcula en el Orquestador con `join(raíz, ID, repositorio)` (o `join(raíz, ID)` sin repositorio), la misma ruta que luego devuelve `createTicketWorkspace`, porque ese método crea carpetas y no puede llamarse antes de confirmar. Un test compara ambas.
- *(desvío de tipo)* **`TicketRunSummary.jiraFetchStatus` admite `null`** (el ticket decía `'ok' | 'fallback_manual'`): vale `null` cuando el flujo se cortó antes de llegar a consultar a Jira (entrada inválida, clave o repositorio no configurados), para no afirmar un `ok` que no ocurrió.
- *(asumido)* **Detalles del flujo:** el ID se normaliza a mayúsculas (`scrum-2` → `SCRUM-2`); el nombre de la desarrolladora (`getMyDisplayName`) se pide después de resolver el tipo, para no gastar una llamada en una épica; el evento `jira:ok` se emite tras resolver el tipo; la confirmación se pide **también sin repositorio** (con `repositoryName`, `branchName` y `baseBranch` en `null`); si la ejecución se cancela, `branchName` vuelve `null` aunque se haya calculado; si `saveFase1` falla, el flujo sigue (el documento se escribe igual y la siguiente ejecución volverá a generar la Fase 1).

- **E2, sin fase roja real:** los 12 casos de E2 pasaron a la primera, porque el flujo completo con todos sus cortes ya quedó implementado al escribir el verde de E1 (no se puede escribir el camino feliz por Git sin decidir qué pasa cuando Git corta). Para comprobar que los tests vigilan el comportamiento se hicieron tres mutaciones temporales del código, todas revertidas: registrar los cambios pendientes como `error` (falla 1 test), ignorar el rechazo de la confirmación (3 tests) y pedir la confirmación antes de inspeccionar Git (8 tests). Con el código restaurado pasan los 36.
- *(asumido)* **Cortes tras confirmar:** si falla la carpeta o el documento después de crear la rama, la fila conserva `branch_status = 'created'` y el nombre de la rama, deja `folder_path` y `document_path` en `NULL` (aunque la carpeta ya exista) y, si el fallo es del documento, conserva `ollama_status` (Ollama sí se ejecutó). Los dos casos se simulan con un doble del gestor de archivos que devuelve `PermisosInsuficientes`.

- **Tarea 3, prueba de integración (`tests/integration/ticket-flow.e2e.test.ts`, 7 casos):** usa `createOrchestrator` con SQLite en un archivo, Git sobre repositorios temporales con un `origin` bare local y carpetas temporales de tickets, y simula con msw solo Jira (proyecto, ticket y `/myself`) y Ollama (streaming de la Fase 1 de un bug, o un 404). Como el Orquestador se arma con sus valores por defecto, la prueba comprueba que `createOrchestrator` ya cablea el flujo con el `JiraRestClient`, el `FileSystemManager` y el `OllamaAITransformer` reales (sin cambios en `create-orchestrator.ts`). Se configura como lo hace la herramienta: `saveConfig`, `addProject` y `addRepository`, sin tocar la base directamente.
  - Comprueba con Git real: el repositorio queda parado en la rama nueva, sin archivos tocados ni commits nuevos; la carpeta y el documento quedan **fuera** del repositorio; con cambios pendientes (un archivo sin versionar) y con la rama solo en `origin` no se crea nada ni se pide confirmar; con la rama ya existente el repositorio **sigue en la rama en la que estaba**; repetir el ticket no duplica la fila de `ticket_logs`.
  - Pasó a la primera (es una prueba de integración de piezas ya cubiertas). Se comprobó con dos mutaciones temporales, revertidas (no guardar `fase1.json` y cambiar la carpeta del ticket), que cada una rompe un test.
  - Cada test tiene un timeout de 30 s: en Windows los comandos de Git tardan más (ver la prueba de TK-03a).

- **Tarea 4, prueba real (2026-11-06, WSL):** con el Jira de pruebas de la desarrolladora (solo lectura), Ollama `qwen2.5:3b` real (solo CPU) y **un repositorio temporal con su propio `origin` local** creado solo para la prueba (ninguno de los repositorios de la desarrolladora; la carpeta se borró al terminar). `createOrchestrator` con una base y una carpeta de tickets temporales; el token no se imprimió.
  - **Bug `SCRUM-2` (Error):** 49 s. Rama `bugs/SCRUM-2-AROCHA` creada y repositorio parado en ella con el árbol limpio; documento de bug con el encabezado completo (nombre real de la cuenta de Jira, enlace al ticket, fecha, rama, repositorio), Fase 1 fiel al ticket (comportamiento actual y pasos), lo ausente como «No especificado en el ticket.» con su pregunta abierta, y `fase1.json` guardado. Carpeta y documento fuera del repositorio.
  - **Historia `SCRUM-3`:** 27 s. `features/SCRUM-3-AROCHA`, plantilla de historia; el ticket no trae historia de usuario ni casos de uso y el documento lo dice, sin inventar.
  - **Mismo bug otra vez:** 29 s. La confirmación avisó `branchAlreadyExists: true`, no se duplicó la rama, `branch_status = 'already_existed'` y el repositorio **quedó en `main`**, la rama en la que estaba. Ollama se volvió a invocar (la reutilización de `fase1.json` es de TK-02h).
  - **Cambios pendientes reales** (un archivo sin versionar): `blocked` `CambiosPendientes` con el archivo en el mensaje, sin pedir confirmación, y fila `pending_changes`.
  - **Confirmación rechazada:** `cancelled: true`, sin rama ni fila.
  - `ticket_logs` quedó con 3 filas (una por ticket y repositorio), sin duplicados.
- **Observación (fuera de este cambio):** cuando el modelo marca los escenarios como ausentes, la sección «Criterios de aceptación» del documento queda **vacía** (la plantilla de TK-02d no pinta nada con una lista vacía). La pregunta abierta lo explica, pero el título se queda sin contenido; se podría imprimir «No especificado en el ticket.» en la plantilla. Se deja anotado, sin cambiar `templates/`.
- **Cierre de la tarea 4:** el patrón «`ErrorBloqueante` → subtipo y mensaje; otro resultado → `ErrorInesperado`», que se repetía 7 veces, quedó en un helper (`failureOf`); los campos de `StartTicketContext` llevan su comentario y todo export nuevo tiene TSDoc en español. `typecheck` y `lint` limpios; 551 tests en verde (43 de este ticket: 36 unitarios y 7 de integración); cobertura de `start-ticket.ts`: 100 % de sentencias y 97 % de ramas (umbral 80 %).

Puntos **(ambiguos o asumidos)** aprobados con el contrato:

1. *(asumido)* **Dependencias nuevas del Orquestador.** `TicketOrchestrator` recibe un cuarto parámetro **opcional** `deps?: { createFileSystem, createTransformer, now }`, con valores por defecto reales (`FileSystemManager` con la carpeta de tickets y los adjuntos de la configuración guardada, `OllamaAITransformer` con `ollamaHost`, `ollamaModel` y `ollamaTimeoutSeconds`, y `new Date()`). Así no cambian ni el constructor que ya usan los tests de TK-02g ni `createOrchestrator`, y los tests de este ticket inyectan dobles o directorios temporales.
2. *(ambiguo)* **`fetchTicket` en `JiraGateway`.** El flujo necesita `fetchTicket`. Añadirlo al tipo `JiraGateway` obliga a poner `fetchTicket: vi.fn()` en el doble de Jira del `setup` de `ticket-orchestrator.config.test.ts` (TK-02g), un test ya aprobado: es una línea, pero necesita tu autorización. Alternativa: un segundo tipo y una segunda fábrica solo para el ticket, sin tocar ese test, a costa de más código.
3. *(asumido)* **Módulo y tipos aparte.** El flujo vive en `start-ticket.ts` y los tipos en `src/shared/types/ticket-run.types.ts`, porque la TUI de TK-03b solo puede importar de `shared` y del Orquestador. `TicketOrchestrator.startTicket` mantiene la firma del ticket y delega.
4. *(ambiguo)* **Fallback manual y tipo de issue.** El prompt manual (`AskCallback`, forma `manualTicket`) devuelve solo `{ title, description }`: sin el tipo de issue. Con Jira caído **no se puede elegir la plantilla** ni el prefijo de rama. Se propone que un ticket manual tenga `issueType` vacío, que ya cae en `historia` (`features/`, regla heredada «un tipo vacío cae en historia»). Un bug cargado a mano saldría con la plantilla de historia. Alternativa: ampliar la respuesta de `manualTicket` con un `issueType` opcional (cambia la firma de `AskCallback`, que TK-03b aún no usa).
5. *(ambiguo)* **Hay repositorios pero no se pasó `repositoryId`.** Lo decide la TUI antes de llamar, pero si llegara vacío con repositorios configurados se propone `blocked` con `ErrorInesperado` («elige un repositorio»), en lugar de generar solo el documento sin avisar. Un `repositoryId` que no es de esa clave también da `blocked`. Sin repositorios configurados, `repositoryId` ausente es el caso normal (CA7).
6. *(asumido)* **Qué se registra y cuándo.** Una sola escritura de `ticket_logs` por ejecución, con `started_at` al comenzar y `finished_at` al terminar. Se registra: éxito, y los cortes de Git (`pending_changes` y `error`, con carpeta, documento y Ollama en `NULL`). **No** se registra: épica, clave no configurada, repositorio inexistente (no hay fila de repositorio que referenciar), cancelación y errores de entrada. Si falla la carpeta o el documento **después** de crear la rama (`PermisosInsuficientes`), se devuelve `blocked`, y la fila lleva la rama creada y `folder_path`/`document_path` en `NULL`.
7. *(asumido)* **Ollama nunca bloquea.** Su fallo da `FallbackDeterminista` y el flujo sigue. No se guarda `fase1.json` si Ollama cayó, y `ollama_error` queda vacío porque `StepResult` no lleva la causa (decisión 10 de TK-02e). Si Ollama responde bien se guarda `fase1.json` (`saveFase1`), que es lo que TK-02h reutilizará.
8. *(asumido)* **Desarrollador/a del encabezado.** Sale de `getMyDisplayName` solo si Jira respondió; si Jira falló o el ticket es manual, queda en blanco y no se reintenta. La fecha es la local del equipo (`DD/MM/AAAA`) y `started_at` / `finished_at` van en ISO (UTC).
9. *(asumido)* **`prompt_version` registrada.** La de la Fase 1 generada, o la del tipo cuando cae en fallback (`bug-v1` / `historia-v1`).
10. *(asumido)* **`onStep`.** Se emiten los pasos `jira`, `git`, `filesystem` y `ollama`, cada uno con `started` y luego `ok`, `fallback` o `error`; el paso `git` se omite cuando la clave no tiene repositorios.
11. *(asumido)* **Prueba de integración.** Reutiliza el aislamiento de Git de los tests de TK-02c (carpeta `HOME` temporal y variables `GIT_*`), con repositorios reales en directorios temporales. Va en `tests/integration/` porque el ticket lo pide, y se ejecuta con `npm test` como el resto.
12. *(asumido)* **Entre TK-02f y TK-02h.** Con solo este ticket, una segunda ejecución del mismo ticket con otro repositorio vuelve a invocar a Ollama (todavía no reutiliza `fase1.json`), y el documento de un repositorio que ya existe no se toca (`writeDocument` es idempotente). `reprocessFase1` no tiene efecto hasta TK-02h. TK-03b depende de los dos, así que el usuario nunca verá este comportamiento intermedio.
