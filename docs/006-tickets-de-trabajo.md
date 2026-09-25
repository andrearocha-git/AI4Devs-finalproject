## 6. Tickets de Trabajo

> Fuentes de verdad: `docs/PRD.md`, `docs/002-arquitectura-del-sistema.md`, `docs/003-modelo-de-datos.md`, `docs/ADR-001-arquitectura-inicial.md`, `docs/005-historias-de-usuario.md`. Lo no especificado en la documentación base se marca **(asumido)**; lo ambiguo o pendiente de definir se marca **(ambiguo)**. El lenguaje/runtime de implementación sigue **(ambiguo)** a nivel de proyecto (ver `002-arquitectura-del-sistema.md` §2.2: "tecnología/lenguaje concreto... [A definir]"); los tres tickets **asumen TypeScript/Node.js** solo para poder nombrar rutas y firmas concretas, siguiendo la convención `.ts` ya usada como ilustrativa en `002-arquitectura-del-sistema.md` §2.3 — si el equipo decide otro stack, las rutas/firmas deben adaptarse sin cambiar el alcance funcional de cada ticket.

---

### TK-01: Implementación del Esquema SQLite (DDL) y del módulo SQLite Storage Manager

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 1 | **Esfuerzo:** Medio
- **Dependencias Previas:** Ninguna

- **Capa / Módulo:** Base de Datos (Storage Layer)

- **Historias de Usuario Relacionadas:** US-01, US-02, US-03

- **Descripción y Alcance:**
  Implementar el esquema SQLite embebido definido en `003-modelo-de-datos.md` — tablas `app_config` (singleton, fila única), `projects_config` y `ticket_logs`, con sus `CHECK`, `UNIQUE` y `FOREIGN KEY` — junto con un sistema de migraciones versionadas y el módulo `SQLiteStorageManager`, único componente del sistema con acceso de lectura/escritura a SQLite (ADR-002.1; Decisión 4 de la auditoría de arquitectura de `002-arquitectura-del-sistema.md`). Debe exponer: lectura de configuración global al arrancar (para que el Orquestador la inyecte por constructor al resto de componentes — Decisión 3 de la misma auditoría), alta/actualización de `projects_config` por `jira_project_key` (semántica *upsert*, US-01 criterio 3), y alta de `ticket_logs` al finalizar un flujo (único escritor: el Orquestador — TK-02). Operar en modo **WAL** (tolerar dos ejecuciones concurrentes del CLI) con el archivo ubicado en `%APPDATA%\DevFlowCLI\devflow.db`.

- **Archivos a Crear / Modificar:**
  - `src/database/schema.sql`
  - `src/database/migrations/0001_initial_schema.sql`
  - `src/database/sqlite-storage-manager.ts`
  - `src/shared/types/config.types.ts` *(asumido: nombre/ubicación de los tipos compartidos — `002-arquitectura-del-sistema.md` §2.3 prevé `src/shared/types/` pero no nombra archivos concretos)*
  - `tests/unit/database/sqlite-storage-manager.test.ts`

- **Contratos e Interfaces (Input/Output):**
  - `getAppConfig(): AppConfig | null`
  - `upsertAppConfig(config: Partial<AppConfig>): void`
  - `getProjectConfig(jiraProjectKey: string): ProjectConfig | null`
  - `upsertProjectConfig(input: { jiraProjectKey: string; repoLocalPath: string; repoRemoteUrl?: string; defaultBaseBranch?: string }): ProjectConfig`
  - `appendTicketLog(entry: TicketLogEntry): void`
  - `AppConfig { id: 1; jiraBaseUrl: string; jiraApiToken: string; jiraTimeoutSeconds: number; ollamaHost: string; ollamaModel: string; ollamaTimeoutSeconds: number; branchPrefixFeature: string; branchPrefixBugfix: string; adjuntosDirName: string; createdAt: string; updatedAt: string }`
  - `ProjectConfig { id: number; jiraProjectKey: string; repoLocalPath: string; repoRemoteUrl?: string; defaultBaseBranch: string; createdAt: string; updatedAt: string }`
  - `TicketLogEntry { ticketId: string; projectConfigId: number; branchType: 'feature' | 'bugfix'; branchName: string; jiraFetchStatus: 'ok' | 'fallback_manual'; jiraFetchError?: string; ollamaStatus: 'ok' | 'fallback_deterministic'; ollamaError?: string; folderPath: string; documentPath: string; startedAt: string; finishedAt?: string }`

- **Criterios de Aceptación Técnicos:**
  1. Ejecutar el DDL sobre una base SQLite en memoria crea las 3 tablas sin error y `PRAGMA foreign_key_check` no reporta violaciones.
  2. `upsertProjectConfig` con una `jira_project_key` repetida actualiza la fila existente (mismo `id`), no crea una segunda fila — cubre US-01 criterio 3.
  3. `appendTicketLog` con `(ticket_id, project_config_id)` ya existentes es rechazado por la restricción `UNIQUE`.
  4. `getAppConfig()` retorna `null` (no lanza excepción) con la tabla vacía — cubre el arranque en frío antes de la configuración inicial (US-01).
  5. Aplicar las migraciones sobre una base vacía dos veces seguidas no falla (idempotencia).

- **Definition of Done (DoD):**
  - [ ] Las 3 tablas + índices creados exactamente como el DDL de `003-modelo-de-datos.md`, sin desviaciones no documentadas.
  - [ ] `SQLiteStorageManager` es el único módulo que importa el driver de SQLite (verificable por regla de lint/búsqueda estática).
  - [ ] Modo WAL habilitado; ruta del archivo configurable, con default `%APPDATA%\DevFlowCLI\devflow.db`.
  - [ ] Migraciones versionadas y documentadas en `src/database/migrations/`.
  - [ ] Umbral de cobertura de tests: **(ambiguo)** — no está definido en el PRD/ADR; a acordar con el equipo antes de dar el ticket por cerrado.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---

### TK-02: Implementación de Jira REST Client, Ollama AI Transformer, Git Manager, FileSystem Manager y Orquestador

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 2 | **Esfuerzo:** Alto
- **Dependencias Previas:** TK-01

- **Capa / Módulo:** Backend / Servicios (Service Layer)

- **Historias de Usuario Relacionadas:** US-02, US-03

- **Descripción y Alcance:**
  Implementar el **Orquestador de Ticket** (coordina Jira → Git → FileSystem → Ollama → FileSystem, emitiendo un evento de progreso por paso — Decisión 1 de la auditoría; único escritor de `ticket_logs` — Decisión 4) y sus cuatro pasos independientes: **Jira REST Client** (HTTP directo + API Token, sin MCP Server — ADR-005.1; un reintento con backoff corto; clasifica `401/403`, `404`, timeout y `429` con `Retry-After` como `FallbackManual` con motivo — ADR-001.1); **Ollama AI Transformer** (invoca Ollama local exigiendo JSON estructurado validado contra schema; cualquier respuesta inválida, con código embebido, o timeout/no disponible cae a `FallbackDeterminista` — ADR-003.1); **Git Manager** (alcance mínimo por decisión de producto: solo verifica existencia del repo y no-existencia de la rama, crea la rama, y es la única escritura del componente sobre el repo del proyecto — sin `commit`, `add` ni `push`); **FileSystem Manager** (crea `/ticket-ID/adjuntos/` y el documento **fuera del repositorio Git**, en la máquina Windows del desarrollador; documento en dos fases con idempotencia de Fase 1 — ADR-004.1). Toda configuración (token, host, timeouts) se resuelve una única vez y se inyecta por constructor (Decisión 3 de la auditoría); ningún componente de este ticket accede a SQLite directamente (esa responsabilidad es exclusiva de TK-01, vía el Orquestador).

- **Archivos a Crear / Modificar:**
  - `src/services/orchestrator/ticket-orchestrator.ts`
  - `src/services/jira/jira-rest-client.ts`
  - `src/services/ollama/ollama-ai-transformer.ts`
  - `src/services/ollama/ollama-response.schema.ts`
  - `src/services/git/git-manager.ts`
  - `src/services/filesystem/filesystem-manager.ts`
  - `src/database/local-file-storage.ts` *(ambiguo: `002-arquitectura-del-sistema.md` §2.2 describe el "Local File Storage" como parte de la Storage Layer, pero §2.3 no lo ubica en el árbol de carpetas; se asume junto a `sqlite-storage-manager.ts` por pertenecer ambos a la Storage Layer)*
  - `src/shared/errors/result.types.ts`
  - `src/shared/config/app-config.provider.ts`
  - `templates/ticket-document.md.hbs`
  - `tests/unit/services/{jira,ollama,git,filesystem,orchestrator}/*.test.ts`
  - `tests/integration/ticket-flow.e2e.test.ts`

- **Contratos e Interfaces (Input/Output):**
  - `type StepResult<T> = { kind: 'Ok'; value: T } | { kind: 'FallbackManual'; reason: 'network_timeout' | 'invalid_token' | 'not_found' } | { kind: 'FallbackDeterminista'; rawText: string } | { kind: 'ErrorBloqueante'; subtype: 'RepositorioNoEncontrado' | 'RamaYaExiste' | 'PermisosInsuficientes' | 'ErrorInesperado'; message: string }`
  - `JiraRestClient.fetchTicket(ticketId: string): Promise<StepResult<ContextoTicket>>` — `ContextoTicket { ticketId: string; title: string; description: string; source: 'jira' | 'manual' }`
  - `OllamaAITransformer.processContext(ctx: ContextoTicket): Promise<StepResult<DocumentoFase1>>` — `DocumentoFase1 { contexto: string; casosDeUso: string; gherkin: string; generatedByOllama: boolean }`; schema esperado del modelo: `{ contexto: string, casosDeUso: string, gherkin: string }`, sin bloques de código.
  - `GitManager.createBranch(input: { repoLocalPath: string; branchType: 'feature' | 'bugfix'; branchName: string }): Promise<StepResult<{ branchName: string; alreadyExisted: boolean }>>`
  - `FileSystemManager.createTicketWorkspace(input: { ticketId: string; adjuntosDirName: string }): Promise<StepResult<{ folderPath: string }>>`
  - `FileSystemManager.writeDocument(input: { documentPath: string; fase1: DocumentoFase1 | { rawText: string }; regenerateFase1Only: boolean }): Promise<StepResult<{ documentPath: string }>>`
  - `TicketOrchestrator.startTicket(ticketId: string, onStep: (step: 'jira' | 'git' | 'filesystem' | 'ollama', status: 'started' | 'ok' | 'fallback' | 'error', detail?: string) => void): Promise<TicketRunSummary>` — `TicketRunSummary { ticketId: string; branchName: string; folderPath: string; documentPath: string; jiraFetchStatus: 'ok' | 'fallback_manual'; ollamaStatus: 'ok' | 'fallback_deterministic' }`

- **Criterios de Aceptación Técnicos:**
  1. `JiraRestClient`: mock HTTP 200 → `Ok(ContextoTicket)` con mapeo correcto; timeout persistente (tras 1 reintento) → `FallbackManual('network_timeout')`; 401/403 → `FallbackManual('invalid_token')`; 404 → `FallbackManual('not_found')`; 429 con `Retry-After` → respetado antes de fallar.
  2. `OllamaAITransformer`: JSON válido contra schema → `Ok`; JSON con un bloque de código Markdown embebido (fenced code block) → `FallbackDeterminista` (verifica el Non-Goal "cero código generado" del PRD); sin respuesta dentro de `ollama_timeout_seconds` → `FallbackDeterminista`.
  3. `GitManager`: repo inexistente → `ErrorBloqueante('RepositorioNoEncontrado')`; rama ya existente → `Ok({ alreadyExisted: true })` sin ejecutar creación; caso feliz → crea la rama exactamente una vez y no ejecuta `commit`/`push` en ningún path (verificable con spy sobre el runner de comandos Git).
  4. `FileSystemManager`: re-ejecutar sobre un ticket ya iniciado regenera solo el bloque de Fase 1 (delimitado por marcadores), preservando intacto el contenido de Fase 2 ya escrito por el desarrollador.
  5. Test de integración del Orquestador: Jira OK + Ollama OK → rama + carpeta + documento + un único registro en `ticket_logs` (SQLite mockeada); Jira fallback + Ollama fallback → el flujo completa igual sin detenerse, documento marcado `⚠️ Generado sin Ollama`.

- **Definition of Done (DoD):**
  - [ ] Ningún componente de este ticket importa el driver de SQLite — toda persistencia pasa por el Orquestador → `SQLiteStorageManager` (TK-01).
  - [ ] `GitManager` no ejecuta `commit`, `add` ni `push` en ningún path de código.
  - [ ] Toda configuración llega por constructor, resuelta una única vez por el Orquestador.
  - [ ] Los 4 tipos de `StepResult` (`Ok`, `FallbackManual`, `FallbackDeterminista`, `ErrorBloqueante`) tienen al menos un test por componente que puede producirlos.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---

### TK-03: Controlador CLI e Interfaz Interactiva de Terminal (Windows)

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 3 | **Esfuerzo:** Medio
- **Dependencias Previas:** TK-01, TK-02

- **Capa / Módulo:** Frontend / TUI (TUI Layer)

- **Historias de Usuario Relacionadas:** US-01, US-02, US-03

- **Descripción y Alcance:**
  Implementar el punto de entrada de línea de comandos `devflow start <ID-ticket>`, el parsing/validación del ID antes de invocar al Orquestador, los prompts interactivos (carga manual de datos de Jira ante `FallbackManual`, confirmación de acciones) y el renderizado de progreso en vivo mediante spinners que consumen los eventos `onStep` emitidos por el Orquestador (TK-02) — comunicación asíncrona basada en eventos, no una llamada bloqueante única (Decisión 1 de la auditoría de arquitectura). Incluye las pantallas de resultado final y las de aviso de `FallbackManual` / `FallbackDeterminista` / `ErrorBloqueante`, cada una con un mensaje distinguible para el usuario. La TUI nunca accede directamente a Jira, Git, Ollama, SQLite o al sistema de archivos — todo pasa por el Orquestador.

- **Archivos a Crear / Modificar:**
  - `src/tui/controller.ts`
  - `src/tui/commands/start.command.ts`
  - `src/tui/commands/config.command.ts` *(asumido: nombre/existencia de este comando — ningún documento base define cómo se ejecuta la configuración inicial de US-01; se infiere su necesidad porque, sin él, `projects_config`/`app_config` no podrían poblarse nunca)*
  - `src/tui/prompts/manual-ticket-entry.prompt.ts`
  - `src/tui/prompts/confirm-actions.prompt.ts`
  - `src/tui/views/progress-view.ts`
  - `src/tui/views/summary-view.ts`
  - `src/tui/views/fallback-view.ts`
  - `tests/unit/tui/*.test.ts`

- **Contratos e Interfaces (Input/Output):**
  - Entrada: `devflow start <TICKET_ID>` → `TicketOrchestrator.startTicket(ticketId, onStep)` (contrato definido en TK-02).
  - `onStep(step: 'jira' | 'git' | 'filesystem' | 'ollama', status: 'started' | 'ok' | 'fallback' | 'error', detail?: string): void`
  - `ManualTicketEntryPrompt.ask(): Promise<{ ticketId: string; title: string; description: string }>`
  - `ConfirmActionsPrompt.ask(summary: { branchName: string; folderPath: string }): Promise<boolean>` *(ambiguo: el PRD/ADR no precisa si la confirmación es una única pantalla consolidada o una por acción; se asume una única confirmación, consistente con la recomendación de reducir fricción ya registrada en la auditoría de arquitectura)*
  - `SummaryView.render(result: TicketRunSummary): void`
  - `isValidTicketId(input: string): boolean`

- **Criterios de Aceptación Técnicos:**
  1. `devflow start` con un ID de formato inválido (vacío o sin guion) no invoca al Orquestador y muestra un mensaje de validación.
  2. Al recibir `onStep('jira', 'fallback')`, la TUI invoca `ManualTicketEntryPrompt` y los datos ingresados se propagan correctamente al flujo (mock del Orquestador).
  3. Al recibir eventos de progreso sucesivos (`started` → `ok` por paso), la vista de progreso actualiza el estado de cada paso sin bloquear el hilo principal.
  4. Al finalizar con `ollamaStatus: 'fallback_deterministic'`, `SummaryView` muestra explícitamente el aviso `⚠️ Generado sin Ollama`.
  5. Al recibir un `ErrorBloqueante` (p. ej. `RepositorioNoEncontrado`), la TUI muestra el mensaje correspondiente y no renderiza una pantalla de éxito.

- **Definition of Done (DoD):**
  - [ ] La TUI no importa clientes de Jira/Git/Ollama ni el storage manager — solo invoca al Orquestador (verificable por revisión de imports).
  - [ ] Los 4 estados de resultado tienen una pantalla/mensaje distinguible para el usuario.
  - [ ] Progreso en vivo (spinners) funcional sin llamada bloqueante única.
  - [ ] Comando y flags reales de configuración inicial (`config.command.ts`) validados con el equipo antes de cerrar el ticket — pendiente por la marca (asumido) arriba.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---
