## 6. Tickets de Trabajo

> Fuentes de verdad: `docs/PRD.md`, `docs/002-arquitectura-del-sistema.md`, `docs/003-modelo-de-datos.md`, `docs/ADR-001-arquitectura-inicial.md`, `docs/005-historias-de-usuario.md`. Lo no especificado en la documentación base se marca **(asumido)**; lo ambiguo o pendiente de definir se marca **(ambiguo)**. El stack está aceptado en el ADR-006.1 (`docs/008-evaluacion-stack-tecnologico.md`): **Node.js ≥ 22.13 + TypeScript `strict`**, `node:sqlite`, Commander + `@inquirer/prompts` + un spinner simple (sin Ink), Handlebars, Ajv, Vitest y msw. Las rutas y firmas de los tickets usan esa convención; los nombres concretos de archivos que `002-arquitectura-del-sistema.md` §2.3 no fija se marcan **(asumido)**.

---

### TK-00: Scaffold del proyecto Node.js + TypeScript (herramientas de build, tests y lint)

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 0 | **Esfuerzo:** Bajo
- **Dependencias Previas:** Ninguna

- **Capa / Módulo:** Infraestructura del proyecto (transversal a las 3 capas)

- **Historias de Usuario Relacionadas:** Ninguna directa — habilita la implementación de US-01, US-02 y US-03 (TK-01 a TK-03).

- **Descripción y Alcance:**
  Crear el armazón mínimo del proyecto en la **raíz del repositorio**, junto a `docs/`, para poder ejecutar `typecheck`, `lint` y `test` antes de escribir cualquier código de la aplicación. Es configuración mecánica: **sin lógica de negocio**. Stack aceptado en el ADR-006.1: Node.js ≥ 22.13 + TypeScript `strict`, Vitest y msw para los tests. Incluye las reglas de lint que hacen verificables las reglas de acoplamiento de capas de `002-arquitectura-del-sistema.md` §2.3 (p. ej. solo `SQLiteStorageManager` puede importar `node:sqlite`; la TUI no importa de `src/database/` ni de los clientes de `src/services/{jira,ollama,git,filesystem}/`). Instala solo las herramientas de desarrollo; las librerías de ejecución (Commander, `@inquirer/prompts`, Handlebars, Ajv) las agrega el ticket que las usa por primera vez *(asumido: evita instalar dependencias sin uso — YAGNI)*. Este ticket existe por separado porque `/04-tdd-pair` no crea el scaffold dentro del ciclo TDD.

- **Archivos a Crear / Modificar:**
  - `package.json` *(`engines.node >= 22.13`, `"type": "module"` *(asumido)*, scripts `typecheck`, `lint`, `test`)*
  - `tsconfig.json` *(`strict: true`; incluye `src/`, `tests/` y `vitest.config.ts`)*
  - `vitest.config.ts`
  - `eslint.config.js` *(asumido: ESLint con `typescript-eslint`; incluye las reglas de importación restringida)*
  - `.gitignore` *(`node_modules/`, `dist/`, `coverage/`)*
  - `tests/unit/smoke.test.ts`
  - `tests/unit/lint-rules.test.ts` *(prueba las reglas de lint con la API de ESLint)*
  - `tests/unit/gitignore.test.ts` *(prueba el `.gitignore` con `git check-ignore`)*
  - `src/.gitkeep` *(para versionar `src/` vacía)*
  - `CLAUDE.md` *(reemplazar la sección "Build / test commands" por los comandos reales)*

- **Contratos e Interfaces (Input/Output):**
  - `npm run typecheck` → `tsc --noEmit`
  - `npm run lint` → ESLint **sin `--fix`** (las skills `/05-verificar-y-revisar` no ejecutan un lint que modifique archivos)
  - `npm test` → `vitest run`
  - Dependencias de desarrollo *(asumido)*: `typescript`, `vitest`, `msw`, `eslint`, `typescript-eslint`, `@types/node`.

- **Criterios de Aceptación Técnicos:**
  1. `npm install` termina sin errores y `package.json` declara `engines.node >= 22.13`.
  2. `npm run typecheck` termina con código 0 sobre el proyecto sin código de aplicación.
  3. `npm test` ejecuta Vitest y pasa con el test de humo `tests/unit/smoke.test.ts`, que verifica que la versión de Node en ejecución es ≥ 22.13 (requisito de `node:sqlite`).
  4. `npm run lint` termina con código 0 y **excluye** `docs/` y `.claude/` (regla de `CLAUDE.md`).
  5. Importar `node:sqlite` fuera de `src/database/sqlite-storage-manager.ts`, o importar de `src/database/` o de los clientes de `src/services/{jira,ollama,git,filesystem}/` desde `src/tui/`, **hace fallar** la regla de lint; verificado de forma automática en `tests/unit/lint-rules.test.ts` con la API de ESLint (sin archivos temporales).
  6. `.gitignore` excluye `node_modules/`, `dist/` y `coverage/` (sin ignorar `src/`, `tests/` ni `docs/`), verificado en `tests/unit/gitignore.test.ts`.

- **Definition of Done (DoD):**
  - [ ] Los tres scripts (`typecheck`, `lint`, `test`) existen y funcionan desde la raíz del repo.
  - [ ] Ningún archivo bajo `docs/` ni `.claude/` se modifica, salvo el contrato `docs/changes/TK-00.md`, la sincronización de este ticket en `docs/006` y la sección de comandos de `CLAUDE.md`.
  - [ ] No hay código de aplicación ni dependencias de ejecución todavía.
  - [ ] Sección "Build / test commands" de `CLAUDE.md` actualizada con los comandos reales.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---

### TK-01: Implementación del Esquema SQLite (DDL) y del módulo SQLite Storage Manager

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 1 | **Esfuerzo:** Medio
- **Dependencias Previas:** TK-00

- **Capa / Módulo:** Base de Datos (Storage Layer)

- **Historias de Usuario Relacionadas:** US-01, US-02, US-03

- **Descripción y Alcance:**
  Implementar el esquema SQLite embebido definido en `003-modelo-de-datos.md` — tablas `app_config` (singleton, fila única), `jira_projects`, `repositories` y `ticket_logs`, con sus `CHECK`, `UNIQUE` y `FOREIGN KEY` — junto con un sistema de migraciones versionadas y el módulo `SQLiteStorageManager`, único componente del sistema con acceso de lectura/escritura a SQLite, usando el driver integrado `node:sqlite` (sin compilación nativa) (ADR-002.1, ADR-006.1; Decisión 4 de la auditoría de arquitectura de `002-arquitectura-del-sistema.md`). Debe exponer: lectura de configuración global al arrancar (para que el Orquestador la inyecte por constructor al resto de componentes — Decisión 3 de la misma auditoría), alta/actualización/baja de claves de proyecto y de sus repositorios (semántica *upsert* por `jira_project_key` y por `(jira_project_id, name)`, US-01), y alta de `ticket_logs` al finalizar un flujo mediante *upsert* por `(ticket_id, repository_id)` (único escritor: el Orquestador — TK-02), tratando aparte el caso `repository_id = NULL` (clave sin repositorios), donde `UNIQUE` no deduplica. Operar en modo **WAL** (tolerar dos ejecuciones concurrentes del CLI) con el archivo ubicado en `%APPDATA%\DevFlowCLI\devflow.db`.

- **Archivos a Crear / Modificar:**
  - `src/database/schema.sql`
  - `src/database/migrations/0001_initial_schema.sql`
  - `src/database/sqlite-storage-manager.ts`
  - `src/shared/types/config.types.ts` *(asumido: nombre/ubicación de los tipos compartidos — `002-arquitectura-del-sistema.md` §2.3 prevé `src/shared/types/` pero no nombra archivos concretos)*
  - `tests/unit/database/sqlite-storage-manager.test.ts`

- **Contratos e Interfaces (Input/Output):**
  - `getAppConfig(): AppConfig | null`
  - `upsertAppConfig(config: Partial<AppConfig>): void`
  - `upsertJiraProject(input: { jiraProjectKey: string; jiraProjectName: string }): JiraProject`
  - `getJiraProject(jiraProjectKey: string): JiraProject | null`
  - `listJiraProjects(): JiraProject[]`
  - `removeJiraProject(jiraProjectKey: string): void` *(borra en cascada sus repositorios)*
  - `upsertRepository(input: { jiraProjectId: number; name: string; repoLocalPath: string; defaultBaseBranch?: string }): Repository`
  - `listRepositories(jiraProjectId: number): Repository[]`
  - `removeRepository(repositoryId: number): void`
  - `upsertTicketLog(entry: TicketLogEntry): void`
  - `AppConfig { id: 1; jiraBaseUrl: string; jiraEmail: string; jiraApiToken: string; jiraTimeoutSeconds: number; ollamaHost: string; ollamaModel: string; ollamaTimeoutSeconds: number; branchPrefixFeature: string; branchPrefixBugfix: string; branchUserSuffix: string; ticketsRootPath: string; adjuntosDirName: string; createdAt: string; updatedAt: string }`
  - `JiraProject { id: number; jiraProjectKey: string; jiraProjectName: string; createdAt: string; updatedAt: string }`
  - `Repository { id: number; jiraProjectId: number; name: string; repoLocalPath: string; defaultBaseBranch: string; createdAt: string; updatedAt: string }`
  - `TicketLogEntry { ticketId: string; jiraProjectId: number; repositoryId: number | null; issueType: string; branchType: 'feature' | 'bugfix'; branchName: string | null; baseBranch: string | null; branchStatus: 'created' | 'already_existed' | 'pending_changes' | 'error' | null; jiraFetchStatus: 'ok' | 'fallback_manual'; jiraFetchError?: string; ollamaStatus: 'ok' | 'fallback_deterministic' | 'reused' | null; ollamaError?: string; promptVersion?: string; folderPath: string | null; documentPath: string | null; startedAt: string; finishedAt?: string }`

- **Criterios de Aceptación Técnicos:**
  1. Ejecutar el DDL sobre una base SQLite en memoria crea las 4 tablas sin error y `PRAGMA foreign_key_check` no reporta violaciones.
  2. `upsertJiraProject` con una `jira_project_key` repetida actualiza la fila existente (mismo `id`), no crea una segunda fila; lo mismo `upsertRepository` con un `(jira_project_id, name)` repetido — cubre US-01 criterio 5.
  3. `removeJiraProject` elimina también sus repositorios (`ON DELETE CASCADE`).
  4. `upsertTicketLog` con `(ticket_id, repository_id)` ya existente actualiza la misma fila; con `repository_id = NULL` y el mismo `ticket_id` también actualiza en lugar de duplicar.
  5. Los `CHECK` rechazan valores fuera de dominio (`branch_status`, `ollama_status` — incluido el nuevo `'reused'` —, `jira_fetch_status`, `branch_type`).
  6. `getAppConfig()` retorna `null` (no lanza excepción) con la tabla vacía — cubre el arranque en frío antes de la configuración inicial (US-01).
  7. Aplicar las migraciones sobre una base vacía dos veces seguidas no falla (idempotencia).
  8. `upsertTicketLog` acepta una ejecución cortada en Git (`branchStatus: 'pending_changes'`, con `folderPath`, `documentPath` y `ollamaStatus` en `null`) y la reejecución posterior del mismo ticket y repositorio actualiza esa misma fila.

- **Definition of Done (DoD):**
  - [ ] Las 4 tablas + índices creados exactamente como el DDL de `003-modelo-de-datos.md`, sin desviaciones no documentadas.
  - [ ] `SQLiteStorageManager` es el único módulo que importa `node:sqlite` (verificable por regla de lint/búsqueda estática).
  - [ ] Modo WAL habilitado; ruta del archivo configurable, con default `%APPDATA%\DevFlowCLI\devflow.db`.
  - [ ] Migraciones versionadas y documentadas en `src/database/migrations/`.
  - [ ] Umbral de cobertura de tests en la Service Layer: **(ambiguo)** — propuesta de 80 %, a confirmar con el equipo antes de dar el ticket por cerrado.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---

### TK-02: Implementación de Jira REST Client, Ollama AI Transformer, Git Manager, FileSystem Manager y Orquestador

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 2 | **Esfuerzo:** Alto
- **Dependencias Previas:** TK-01

- **Capa / Módulo:** Backend / Servicios (Service Layer)

- **Historias de Usuario Relacionadas:** US-02, US-03

- **Descripción y Alcance:**
  Implementar el **Orquestador de Ticket** (coordina Jira → Git → FileSystem → Ollama → FileSystem para **un repositorio por ejecución**, emitiendo un evento de progreso por paso — Decisión 1 de la auditoría; resuelve el tipo de issue con `templates/issue-types.json` y corta el flujo en las épicas; reutiliza la Fase 1 entre repositorios del mismo ticket; único escritor de `ticket_logs` — Decisión 4) y sus cuatro pasos independientes:
  - **Jira REST Client** (API REST **v2** de Jira Cloud, HTTP directo con Basic email + API Token, sin MCP Server — ADR-005.1; un reintento con backoff corto; clasifica `401/403`, `404`, timeout y `429` con `Retry-After` como `FallbackManual` con motivo; **ante un 404 llama a `/myself`**: 401 = `invalid_token`, 200 = `not_found`; valida claves con `GET /rest/api/2/project/{key}`; lista los tickets asignados con la JQL `project in (…) AND assignee = currentUser() AND statusCategory != Done AND issuetype != Epic ORDER BY updated DESC`; obtiene el `displayName` de `/myself` — ADR-001.1).
  - **Ollama AI Transformer** (arma el prompt con los archivos de `templates/prompts/` según el tipo de issue; invoca Ollama local con *streaming* y el JSON Schema del tipo en `format`; valida con Ajv —el JSON Schema es la fuente de verdad, no Zod—; aplica el posprocesado determinista `siFalta` / `verificarLiterales`; cualquier respuesta inválida, con código embebido, o timeout/no disponible cae a `FallbackDeterminista` — ADR-003.1).
  - **Git Manager** (secuencia de [ADR-007.1](ADR-001-arquitectura-inicial.md#adr-0071-ampliación-del-alcance-del-git-manager--verificación-del-working-directory-y-rama-creada-desde-la-base-actualizada): verifica el repo; `git status --porcelain` y se detiene listando los cambios pendientes; si la rama ya existe informa y continúa; actualiza la rama base con `git pull --ff-only origin <base>` o `git fetch origin <base>:<base>` según la rama actual; crea la rama con `git switch -c <rama> <base>`; si el pull falla es error bloqueante; override puntual con `--base`; **nunca** `commit`, `add` ni `push`).
  - **FileSystem Manager** (crea `<raíz>\ID\<repositorio>\adjuntos\` y el documento **fuera del repositorio Git**; documento en dos fases con idempotencia de Fase 1; guarda y lee `ID\.devflow\fase1.json` para la reutilización; renderiza con Handlebars la plantilla del tipo — ADR-004.1).

  Toda configuración (credenciales, host, timeouts, sufijo de rama, raíz de tickets) se resuelve una única vez y se inyecta por constructor (Decisión 3 de la auditoría); ningún componente de este ticket accede a SQLite directamente (esa responsabilidad es exclusiva de TK-01, vía el Orquestador).

- **Archivos a Crear / Modificar:**
  - `src/services/orchestrator/ticket-orchestrator.ts`
  - `src/services/orchestrator/issue-type-resolver.ts` *(asumido: nombre del módulo que aplica `templates/issue-types.json`)*
  - `src/services/jira/jira-rest-client.ts`
  - `src/services/ollama/ollama-ai-transformer.ts`
  - `src/services/ollama/postprocess.ts` *(asumido: nombre del módulo del posprocesado determinista)*
  - `src/services/git/git-manager.ts`
  - `src/services/filesystem/filesystem-manager.ts`
  - `src/database/local-file-storage.ts` *(ambiguo: `002-arquitectura-del-sistema.md` §2.2 describe el "Local File Storage" como parte de la Storage Layer; se ubica junto a `sqlite-storage-manager.ts` por pertenecer ambos a la Storage Layer)*
  - `src/shared/errors/result.types.ts`
  - `src/shared/config/app-config.provider.ts`
  - `templates/README.md`, `templates/issue-types.json`
  - `templates/prompts/{comun.system.md, bug.system.md, historia.system.md, ticket.user.md, bug.schema.json, historia.schema.json}`
  - `templates/documents/{bug.md.hbs, historia.md.hbs}`
  - `tests/fixtures/tickets/*.json` (tickets en formato Jira v2: bug y historia, completos y escuetos, y una épica)
  - `tests/unit/services/{jira,ollama,git,filesystem,orchestrator}/*.test.ts`
  - `tests/integration/ticket-flow.e2e.test.ts`

- **Contratos e Interfaces (Input/Output):**
  - `type StepResult<T> = { kind: 'Ok'; value: T } | { kind: 'FallbackManual'; reason: 'network_timeout' | 'invalid_token' | 'not_found' } | { kind: 'FallbackDeterminista'; rawText: string } | { kind: 'ErrorBloqueante'; subtype: 'RepositorioNoEncontrado' | 'CambiosPendientes' | 'PullFallido' | 'TipoIssueBloqueado' | 'PermisosInsuficientes' | 'ErrorInesperado'; message: string }`
  - `JiraRestClient.fetchTicket(ticketId: string): Promise<StepResult<ContextoTicket>>` — `ContextoTicket { ticketId: string; title: string; description: string; issueType: string; source: 'jira' | 'manual' }`
  - `JiraRestClient.validateProjectKey(key: string): Promise<StepResult<{ key: string; name: string }>>`
  - `JiraRestClient.listAssignedTickets(projectKeys: string[]): Promise<StepResult<Array<{ ticketId: string; title: string; issueType: string }>>>`
  - `JiraRestClient.getMyDisplayName(): Promise<StepResult<string>>`
  - `OllamaAITransformer.processContext(ctx: ContextoTicket, tipo: 'bug' | 'historia', onToken?: (chars: number) => void): Promise<StepResult<DocumentoFase1>>` — `DocumentoFase1` es la respuesta del JSON Schema del tipo, ya posprocesada, más `generatedByOllama: boolean` y `promptVersion: string`. Ambos schemas empiezan por `presenteEnTicket` y incluyen `resumen`, `escenarios[] { titulo, given, when, then }` y `preguntasAbiertas[]`; el de **bug** suma `pasosParaReproducir[]`, `comportamientoEsperado`, `comportamientoActual` y `entorno`; el de **historia**, `historiaUsuario { como, quiero, para }` y `casosDeUso[]`. Sin bloques de código.
  - `GitManager.validateRepository(input: { repoLocalPath: string; baseBranch: string }): Promise<StepResult<void>>` — usado al dar de alta un repositorio: verifica que sea un repositorio Git con remoto `origin` y que la rama base exista en el remoto.
  - `GitManager.createBranch(input: { repoLocalPath: string; branchName: string; baseBranch: string }): Promise<StepResult<{ branchName: string; baseBranch: string; alreadyExisted: boolean }>>` — los cambios pendientes se reportan como `ErrorBloqueante('CambiosPendientes')` con la lista de archivos en `message`.
  - `FileSystemManager.createTicketWorkspace(input: { ticketId: string; repositoryName?: string; ticketsRootPath: string; adjuntosDirName: string }): Promise<StepResult<{ folderPath: string }>>`
  - `FileSystemManager.readFase1(ticketId: string): Promise<StepResult<DocumentoFase1 | null>>` / `saveFase1(ticketId: string, fase1: DocumentoFase1): Promise<StepResult<void>>`
  - `FileSystemManager.writeDocument(input: { documentPath: string; tipo: 'bug' | 'historia'; fase1: DocumentoFase1 | { rawText: string }; repo?: string; rama?: string; regenerateFase1Only: boolean }): Promise<StepResult<{ documentPath: string }>>`
  - **Contrato de la TUI con el Orquestador** (la TUI no accede a Jira, Git ni SQLite; todo pasa por estos métodos):
    - `TicketOrchestrator.listAssignedTickets(): Promise<StepResult<Array<{ ticketId: string; title: string; issueType: string }>>>` — usa las claves dadas de alta.
    - `TicketOrchestrator.listRepositoriesForTicket(ticketId: string): StepResult<Repository[]>` — deriva la clave del ID; falla antes de llamar a Jira si la clave no está configurada, con las claves disponibles en el mensaje.
    - `TicketOrchestrator.listProjects(): JiraProject[]` / `addProject(key: string): Promise<StepResult<JiraProject>>` (valida contra Jira) / `removeProject(key: string): void`
    - `TicketOrchestrator.addRepository(input: { jiraProjectKey: string; name: string; repoLocalPath: string; defaultBaseBranch?: string }): Promise<StepResult<Repository>>` (valida con `GitManager.validateRepository`) / `updateRepository(...)` / `removeRepository(repositoryId: number): void`
    - `TicketOrchestrator.suggestBranchSuffix(): Promise<StepResult<string>>` (desde el `displayName` de `/myself`) / `getConfig(): AppConfig | null` / `saveConfig(config: Partial<AppConfig>): void`
  - `type AskRequest = { kind: 'manualTicket'; ticketId: string; reason: 'network_timeout' | 'invalid_token' | 'not_found' }` y `type AskCallback = (request: AskRequest) => Promise<{ title: string; description: string }>` — único punto en el que el Orquestador pide datos al usuario durante un flujo (carga manual ante `FallbackManual` de Jira). La elección del repositorio **no** se pide a mitad del flujo: la TUI la resuelve antes con `listRepositoriesForTicket` y pasa `repositoryId`.
  - `TicketOrchestrator.startTicket(input: { ticketId: string; repositoryId?: number; baseBranchOverride?: string }, hooks: { onStep: (step: 'jira' | 'git' | 'filesystem' | 'ollama', status: 'started' | 'ok' | 'fallback' | 'error', detail?: string) => void; ask: AskCallback }): Promise<TicketRunSummary>` — `TicketRunSummary { ticketId: string; repositoryId: number | null; issueType: string; branchName: string | null; branchStatus: 'created' | 'already_existed' | 'pending_changes' | 'error' | null; folderPath: string | null; documentPath: string | null; jiraFetchStatus: 'ok' | 'fallback_manual'; ollamaStatus: 'ok' | 'fallback_deterministic' | 'reused' | null; promptVersion?: string; blocked?: { subtype: string; message: string } }` — `folderPath`, `documentPath` y `ollamaStatus` son `null` cuando el flujo se cortó en Git; el Orquestador igualmente registra la ejecución en `ticket_logs`.

- **Criterios de Aceptación Técnicos:**
  1. `JiraRestClient`: mock HTTP 200 → `Ok(ContextoTicket)` con mapeo correcto (`description` en texto plano); timeout persistente (tras 1 reintento) → `FallbackManual('network_timeout')`; 401/403 → `FallbackManual('invalid_token')`; 404 en `/issue` seguido de `/myself` 401 → `FallbackManual('invalid_token')`, y seguido de `/myself` 200 → `FallbackManual('not_found')`; 429 con `Retry-After` → respetado antes de fallar. `validateProjectKey` aplica la misma regla del 404.
  2. `OllamaAITransformer`: JSON válido contra el schema del tipo → `Ok`; JSON con un bloque de código Markdown embebido (fenced code block) → `FallbackDeterminista` (verifica el Non-Goal "cero código generado" del PRD); sin respuesta dentro de `ollama_timeout_seconds` → `FallbackDeterminista`. El posprocesado sobrescribe con "No especificado en el ticket." los campos marcados como ausentes en `presenteEnTicket` y agrega la pregunta abierta; en bugs descarta literales ausentes del ticket (verificable con los fixtures escuetos).
  3. `GitManager` (sobre repositorios Git temporales): repo inexistente → `ErrorBloqueante('RepositorioNoEncontrado')`; cambios pendientes → `ErrorBloqueante('CambiosPendientes')` sin ejecutar pull ni creación; rama ya existente → `Ok({ alreadyExisted: true })` sin pull ni creación; parado en la rama base → `git pull --ff-only origin <base>`; parado en otra rama → `git fetch origin <base>:<base>`; pull fallido → `ErrorBloqueante('PullFallido')` sin crear la rama; caso feliz → crea la rama exactamente una vez con `git switch -c <rama> <base>`; en ningún path se ejecuta `commit`, `add` ni `push` (verificable con spy sobre el runner de comandos Git).
  4. `FileSystemManager`: re-ejecutar sobre un ticket ya iniciado regenera solo el bloque de Fase 1 (delimitado por los marcadores `<!-- DEVFLOW:FASE1:INICIO -->` / `<!-- DEVFLOW:FASE1:FIN -->`), preservando intacto el contenido de Fase 2 ya escrito por el desarrollador; ejecutar el mismo ticket con un segundo repositorio crea una carpeta y un documento propios y copia la Fase 1 guardada en `fase1.json`.
  5. Test de integración del Orquestador: ejecución cortada por cambios pendientes → resumen con `blocked`, `folderPath`/`documentPath`/`ollamaStatus` en `null` y una fila en `ticket_logs` con `branch_status = 'pending_changes'`; Jira fallback → se invoca `ask({ kind: 'manualTicket' })` y el flujo continúa con los datos devueltos; Jira OK + Ollama OK → rama + carpeta + documento + un único registro en `ticket_logs` (SQLite mockeada) con `prompt_version`; Jira fallback + Ollama fallback → el flujo completa igual sin detenerse, documento marcado `⚠️ Generado sin Ollama`; épica → aviso sin rama, carpeta, documento ni registro; segunda ejecución con otro repositorio → `ollamaStatus: 'reused'` sin invocar a Ollama; clave sin repositorios → solo documento, `repositoryId: null` y sin pasos de Git.

- **Definition of Done (DoD):**
  - [ ] Ningún componente de este ticket importa `node:sqlite` — toda persistencia pasa por el Orquestador → `SQLiteStorageManager` (TK-01).
  - [ ] `GitManager` no ejecuta `commit`, `add` ni `push` en ningún path de código.
  - [ ] Toda configuración llega por constructor, resuelta una única vez por el Orquestador.
  - [ ] Los 4 tipos de `StepResult` (`Ok`, `FallbackManual`, `FallbackDeterminista`, `ErrorBloqueante`) tienen al menos un test por componente que puede producirlos.
  - [ ] Al cambiar un prompt o un schema se sube `promptVersion` del tipo en `templates/issue-types.json`.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---

### TK-03: Controlador CLI e Interfaz Interactiva de Terminal (Windows)

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 3 | **Esfuerzo:** Medio
- **Dependencias Previas:** TK-01, TK-02

- **Capa / Módulo:** Frontend / TUI (TUI Layer)

- **Historias de Usuario Relacionadas:** US-01, US-02, US-03

- **Descripción y Alcance:**
  Implementar el punto de entrada de línea de comandos con Commander — `devflow start [ID] [--base <rama>]` y `devflow config` (sufijo de usuario y `devflow config proyectos`: agregar, listar, editar y quitar claves y repositorios) —, el parsing/validación del ID antes de invocar al Orquestador, los prompts interactivos con `@inquirer/prompts` (elección de ticket en la lista de asignados, elección de repositorio —preseleccionado si la clave tiene uno solo—, carga manual de datos de Jira ante `FallbackManual`, confirmación de acciones, alta de claves y repositorios) y el renderizado de progreso en vivo mediante un spinner simple que consume los eventos `onStep` emitidos por el Orquestador (TK-02), incluido el progreso del *streaming* de Ollama — comunicación asíncrona basada en eventos, no una llamada bloqueante única (Decisión 1 de la auditoría de arquitectura). **Sin Ink**: Ink e inquirer compiten por stdin. Incluye las pantallas de resultado final y las de aviso de `FallbackManual` / `FallbackDeterminista` / `ErrorBloqueante` (listado de cambios pendientes, fallo del pull, aviso de épica), cada una con un mensaje distinguible para el usuario. La TUI nunca accede directamente a Jira, Git, Ollama, SQLite o al sistema de archivos — todo pasa por el Orquestador.

- **Archivos a Crear / Modificar:**
  - `src/tui/cli.ts`
  - `src/tui/commands/start.command.ts`
  - `src/tui/commands/config.command.ts` *(asumido: nombre de este comando — ningún documento base define cómo se ejecuta la configuración inicial de US-01; `devflow config` y `devflow config proyectos` son la propuesta, porque sin él las tablas de configuración no podrían poblarse nunca)*
  - `src/tui/prompts/ticket-selection.prompt.ts`
  - `src/tui/prompts/repository-selection.prompt.ts`
  - `src/tui/prompts/manual-ticket-entry.prompt.ts`
  - `src/tui/prompts/confirm-actions.prompt.ts`
  - `src/tui/prompts/project-config.prompt.ts`
  - `src/tui/views/progress-view.ts`
  - `src/tui/views/summary-view.ts`
  - `src/tui/views/fallback-view.ts`
  - `tests/unit/tui/*.test.ts`

- **Contratos e Interfaces (Input/Output):**
  - Entrada: `devflow start [TICKET_ID] [--base <rama>]` → sin `TICKET_ID`, la TUI obtiene la lista con `TicketOrchestrator.listAssignedTickets()` y presenta `TicketSelectionPrompt`; con el ID resuelto, obtiene los repositorios con `listRepositoriesForTicket(ticketId)`, presenta `RepositorySelectionPrompt` si hay más de uno y llama a `TicketOrchestrator.startTicket({ ticketId, repositoryId, baseBranchOverride }, { onStep, ask })` (contratos definidos en TK-02), donde `ask` abre `ManualTicketEntryPrompt`.
  - `onStep(step: 'jira' | 'git' | 'filesystem' | 'ollama', status: 'started' | 'ok' | 'fallback' | 'error', detail?: string): void` y `ask: AskCallback` (TK-02)
  - `TicketSelectionPrompt.ask(tickets: Array<{ ticketId: string; title: string; issueType: string }>): Promise<string>`
  - `RepositorySelectionPrompt.ask(repositories: Array<{ id: number; name: string; repoLocalPath: string }>): Promise<number>`
  - `ManualTicketEntryPrompt.ask(): Promise<{ ticketId: string; title: string; description: string }>`
  - `ConfirmActionsPrompt.ask(summary: { branchName: string | null; baseBranch: string | null; folderPath: string }): Promise<boolean>` *(ambiguo: el PRD/ADR no precisa si la confirmación es una única pantalla consolidada o una por acción; se asume una única confirmación, consistente con la recomendación de reducir fricción ya registrada en la auditoría de arquitectura)*
  - `SummaryView.render(result: TicketRunSummary): void`
  - `isValidTicketId(input: string): boolean` — formato `<CLAVE>-<número>` (`^[A-Z][A-Z0-9_]+-\d+$`).

- **Criterios de Aceptación Técnicos:**
  1. `devflow start` con un ID de formato inválido (vacío o sin guion) no invoca al Orquestador y muestra un mensaje de validación; con un ID de una clave no configurada, muestra el mensaje del Orquestador con las claves disponibles.
  2. `devflow start` sin ID muestra la lista de tickets asignados que devuelve el Orquestador y continúa con el elegido (mock del Orquestador).
  3. Al invocar el Orquestador el callback `ask({ kind: 'manualTicket' })`, la TUI abre `ManualTicketEntryPrompt` con el motivo del fallo y devuelve los datos ingresados al flujo (mock del Orquestador); `onStep('jira', 'fallback')` actualiza además el spinner.
  4. Antes de llamar a `startTicket`: si la clave del ticket tiene varios repositorios, la TUI pide elegir uno; con uno solo lo preselecciona; sin repositorios no muestra la selección y no pasa `repositoryId`.
  5. Al recibir eventos de progreso sucesivos (`started` → `ok` por paso), la vista de progreso actualiza el estado de cada paso sin bloquear el hilo principal.
  6. Al finalizar con `ollamaStatus: 'fallback_deterministic'`, `SummaryView` muestra explícitamente el aviso `⚠️ Generado sin Ollama`; con `'reused'`, indica que se reutilizó el análisis del ticket.
  7. Al recibir un resumen con `blocked` (`RepositorioNoEncontrado`, `CambiosPendientes` con la lista de archivos, `PullFallido`, `TipoIssueBloqueado`), la TUI muestra el mensaje correspondiente y no renderiza una pantalla de éxito.
  8. `devflow config proyectos` permite agregar una clave (validada por el Orquestador), asociarle repositorios con su rama base y quitar claves o repositorios; y `devflow config` propone el sufijo de usuario sugerido desde Jira, que el usuario confirma o edita.

- **Definition of Done (DoD):**
  - [ ] La TUI no importa clientes de Jira/Git/Ollama ni el storage manager — solo invoca al Orquestador (verificable por revisión de imports).
  - [ ] Los 4 estados de resultado tienen una pantalla/mensaje distinguible para el usuario.
  - [ ] Progreso en vivo (spinner) funcional sin llamada bloqueante única y sin dependencia de Ink.
  - [ ] Comandos y flags reales de configuración inicial (`config.command.ts`) validados con el equipo antes de cerrar el ticket — pendiente por la marca (asumido) arriba.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---
