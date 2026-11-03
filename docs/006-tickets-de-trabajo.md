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
  - [x] Los tres scripts (`typecheck`, `lint`, `test`) existen y funcionan desde la raíz del repo.
  - [x] Ningún archivo bajo `docs/` ni `.claude/` se modifica, salvo el contrato `docs/changes/TK-00.md`, la sincronización de este ticket en `docs/006` y la sección de comandos de `CLAUDE.md`.
  - [x] No hay código de aplicación ni dependencias de ejecución todavía.
  - [x] Sección "Build / test commands" de `CLAUDE.md` actualizada con los comandos reales.
  - [x] Revisión de código aprobada y mergeada a la rama del ticket.

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
  - [x] Las 4 tablas + índices creados exactamente como el DDL de `003-modelo-de-datos.md`, sin desviaciones no documentadas.
  - [x] `SQLiteStorageManager` es el único módulo que importa `node:sqlite` (verificable por regla de lint/búsqueda estática).
  - [ ] Modo WAL habilitado; ruta del archivo configurable, con default `%APPDATA%\DevFlowCLI\devflow.db`. *(WAL y ruta configurable están hechos; el valor por defecto lo calcula quien instancia el manager y se resuelve en TK-02a, por eso sigue abierta)*
  - [x] Migraciones versionadas y documentadas en `src/database/migrations/`.
  - [ ] Umbral de cobertura de tests en la Service Layer: **decidido (2026-11-02): 80 %**; se configura y verifica en TK-02a, cuando exista la Service Layer. Esta casilla se cierra con ese ticket.
  - [x] Revisión de código aprobada y mergeada a la rama del ticket.

---

### TK-02: Service Layer — Jira, Ollama, Git, FileSystem y Orquestador (ticket paraguas dividido en TK-02a … TK-02g)

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 2 | **Esfuerzo total:** Alto
- **Dependencias Previas:** TK-01
- **Capa / Módulo:** Backend / Servicios (Service Layer)
- **Historias de Usuario Relacionadas:** US-02, US-03

> **División (2026-11-02).** El TK-02 original (Jira REST Client, Ollama AI Transformer, Git Manager, FileSystem Manager y Orquestador en un solo ticket) tenía 5 componentes, 5 criterios técnicos y unos 17 archivos: no cabía en un contrato de 2-3 escenarios y 5 tareas (`/03-refinar-historia`, chequeo INVEST: fallaban S y T). Se divide en siete sub-tickets, cada uno con su propio contrato en `docs/changes/TK-02x.md`. **TK-02 deja de implementarse como unidad**: es solo el paraguas; se considera cerrado cuando TK-02a … TK-02g lo están. Los criterios técnicos originales CA1-CA5 se conservan dentro del sub-ticket que los cubre.

| Sub-ticket | Alcance | CA originales | Esfuerzo | Depende de |
|---|---|---|---|---|
| **TK-02a** | Base compartida: `StepResult`, `AppConfigProvider`, resolutor de tipo de issue, fixtures, regla de lint | Soporte (DoD) | Bajo | TK-01 |
| **TK-02b** | Jira REST Client | CA1 | Medio | TK-02a |
| **TK-02c** | Git Manager | CA3 | Medio | TK-02a |
| **TK-02d** | FileSystem Manager y plantillas de documento | CA4 | Medio | TK-02a |
| **TK-02e** | Ollama AI Transformer, prompts, schemas y posprocesado | CA2 | Medio-Alto | TK-02a |
| **TK-02f** | Orquestador: flujo `startTicket` y `ticket_logs` | CA5 | Alto | TK-02b, c, d, e |
| **TK-02g** | Orquestador: gestión de configuración, proyectos y repositorios para la TUI | Contrato TUI | Medio | TK-02b, TK-02c |

Orden sugerido: TK-02a → TK-02b, c, d y e (independientes entre sí) → TK-02f → TK-02g. TK-03a depende de TK-02g y TK-03b de TK-02f (y de TK-03a).

**Reglas comunes a todos los sub-tickets** (Decisiones 1, 3 y 4 de la auditoría): toda configuración (credenciales, host, timeouts, sufijo de rama, raíz de tickets) se resuelve una única vez y se inyecta por constructor; ningún componente de la Service Layer accede a SQLite directamente (solo el Orquestador, vía `SQLiteStorageManager` de TK-01); todo paso devuelve `StepResult` y ninguna falla de una integración llega a la TUI como excepción cruda.

---

#### TK-02a: Base compartida de la Service Layer (tipos de resultado, configuración, tipo de issue y fixtures)

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 2 (1.º) | **Esfuerzo:** Bajo
- **Dependencias Previas:** TK-01
- **Historias de Usuario Relacionadas:** US-02, US-03

- **Descripción y Alcance:**
  Define lo que comparten los demás sub-tickets para que puedan avanzar en paralelo: el contrato `StepResult`, el proveedor de configuración inyectable, la resolución del tipo de issue con `templates/issue-types.json` (épica → bloqueada; Bug/Error/Defecto → `bug`; el resto → `historia`; prefijo de rama `features/` o `bugs/`; `promptVersion` por tipo), los fixtures de tickets en formato Jira v2 y la regla de lint que restringe quién importa `sqlite-storage-manager.ts`. Toma además las decisiones que TK-01 dejó abiertas (ver "Decisiones a cerrar").

- **Archivos a Crear / Modificar:**
  - `src/shared/errors/result.types.ts`
  - `src/shared/config/app-config.provider.ts` *(ambiguo: alcance exacto; se propone una función/clase que, a partir de un `AppConfig` ya leído por el Orquestador, valida los campos obligatorios y calcula los valores por defecto —p. ej. la ruta de la base `%APPDATA%\DevFlowCLI\devflow.db`— y devuelve una configuración inmutable)*
  - `src/services/orchestrator/issue-type-resolver.ts` *(asumido: nombre del módulo que aplica `templates/issue-types.json`)*
  - `templates/README.md`, `templates/issue-types.json`
  - `tests/fixtures/tickets/*.json` (tickets en formato Jira v2: bug y historia, completos y escuetos, y una épica)
  - `tests/unit/shared/*.test.ts`, `tests/unit/services/orchestrator/issue-type-resolver.test.ts`
  - `eslint.config.js` (modificar)

- **Contratos e Interfaces (Input/Output):**
  - `type StepResult<T> = { kind: 'Ok'; value: T } | { kind: 'FallbackManual'; reason: 'network_timeout' | 'invalid_token' | 'not_found' } | { kind: 'FallbackDeterminista'; rawText: string } | { kind: 'ErrorBloqueante'; subtype: 'RepositorioNoEncontrado' | 'CambiosPendientes' | 'PullFallido' | 'TipoIssueBloqueado' | 'PermisosInsuficientes' | 'ErrorInesperado'; message: string }`
  - `ContextoTicket { ticketId: string; title: string; description: string; issueType: string; source: 'jira' | 'manual' }`
  - Resolutor de tipo: dado el `issueType` de Jira devuelve `{ tipo: 'bug' | 'historia'; prefijoRama: 'features' | 'bugs'; promptVersion: string }` o `ErrorBloqueante('TipoIssueBloqueado')` para épicas *(asumido: forma exacta del retorno)*.

- **Decisiones a cerrar en este ticket** (heredadas de TK-01):
  - Umbral de cobertura de la Service Layer: **80 %** (decidido 2026-11-02); aquí solo se configura y se hace cumplir.
  - Regla de lint para que solo el Orquestador importe `sqlite-storage-manager.ts`.
  - Dónde se calcula el valor por defecto de la ruta de la base y dónde se validan los campos obligatorios del primer `upsertAppConfig`.

- **Criterios de Aceptación Técnicos** *(derivados del DoD y de las decisiones del ticket original; no tienen CA numerado en la versión previa)*:
  1. Los 4 tipos de `StepResult` están definidos y son discriminables por `kind` (verificado por el compilador y por un test de tipos o de estrechamiento).
  2. El resolutor clasifica Epic/Épica como bloqueada, Bug/Error/Defecto como `bug` y cualquier otro tipo como `historia`, con el prefijo de rama y la `promptVersion` del tipo leídos de `templates/issue-types.json`.
  3. El proveedor de configuración rechaza una configuración con campos obligatorios ausentes y completa los valores por defecto; es inmutable y se inyecta por constructor.
  4. `npm run lint` falla si un archivo distinto del Orquestador (o de los tests) importa `src/database/sqlite-storage-manager.ts`.

- **Definition of Done (DoD):**
  - [ ] Los fixtures cubren bug y historia (completos y escuetos) y una épica.
  - [ ] Umbral de cobertura del 80 % configurado en `vitest.config.ts` para la Service Layer y registrado en `docs/changes/TK-02a.md`.
  - [ ] Regla de lint verificada con un caso que la viola.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---

#### TK-02b: Jira REST Client

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 2 (2.º) | **Esfuerzo:** Medio
- **Dependencias Previas:** TK-02a
- **Historias de Usuario Relacionadas:** US-02

- **Descripción y Alcance:**
  Cliente de la API REST **v2** de Jira Cloud, HTTP directo con Basic email + API Token, sin MCP Server (ADR-005.1). Un reintento con backoff corto; clasifica `401/403`, `404`, timeout y `429` con `Retry-After` como `FallbackManual` con motivo; **ante un 404 llama a `/myself`**: 401 = `invalid_token`, 200 = `not_found`. Valida claves con `GET /rest/api/2/project/{key}`; lista los tickets asignados con la JQL `project in (…) AND assignee = currentUser() AND statusCategory != Done AND issuetype != Epic ORDER BY updated DESC`; obtiene el `displayName` de `/myself` (ADR-001.1). Recibe credenciales, host y timeouts por constructor.

- **Archivos a Crear / Modificar:**
  - `src/services/jira/jira-rest-client.ts`
  - `tests/unit/services/jira/*.test.ts` (HTTP simulado con msw)

- **Contratos e Interfaces (Input/Output):**
  - `JiraRestClient.fetchTicket(ticketId: string): Promise<StepResult<ContextoTicket>>`
  - `JiraRestClient.validateProjectKey(key: string): Promise<StepResult<{ key: string; name: string }>>`
  - `JiraRestClient.listAssignedTickets(projectKeys: string[]): Promise<StepResult<Array<{ ticketId: string; title: string; issueType: string }>>>`
  - `JiraRestClient.getMyDisplayName(): Promise<StepResult<string>>`

- **Criterios de Aceptación Técnicos:**
  1. (CA1 original) `JiraRestClient`: mock HTTP 200 → `Ok(ContextoTicket)` con mapeo correcto (`description` en texto plano); timeout persistente (tras 1 reintento) → `FallbackManual('network_timeout')`; 401/403 → `FallbackManual('invalid_token')`; 404 en `/issue` seguido de `/myself` 401 → `FallbackManual('invalid_token')`, y seguido de `/myself` 200 → `FallbackManual('not_found')`; 429 con `Retry-After` → respetado antes de fallar. `validateProjectKey` aplica la misma regla del 404.

- **Definition of Done (DoD):**
  - [ ] Todas las credenciales, el host y los timeouts llegan por constructor.
  - [ ] Hay al menos un test para `Ok` y para cada motivo de `FallbackManual`.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---

#### TK-02c: Git Manager

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 2 (3.º) | **Esfuerzo:** Medio
- **Dependencias Previas:** TK-02a
- **Historias de Usuario Relacionadas:** US-03

- **Descripción y Alcance:**
  Secuencia de [ADR-007.1](ADR-001-arquitectura-inicial.md#adr-0071-ampliación-del-alcance-del-git-manager--verificación-del-working-directory-y-rama-creada-desde-la-base-actualizada): verifica el repo; `git status --porcelain` y se detiene listando los cambios pendientes; si la rama ya existe informa y continúa; actualiza la rama base con `git pull --ff-only origin <base>` o `git fetch origin <base>:<base>` según la rama actual; crea la rama con `git switch -c <rama> <base>`; si el pull falla es error bloqueante; override puntual con `--base`; **nunca** `commit`, `add` ni `push`. Toda ejecución pasa por un runner de comandos Git inyectable (permite el spy y los tests sin red).

- **Archivos a Crear / Modificar:**
  - `src/services/git/git-manager.ts`
  - `tests/unit/services/git/*.test.ts` (repositorios Git temporales)

- **Contratos e Interfaces (Input/Output):**
  - `GitManager.validateRepository(input: { repoLocalPath: string; baseBranch: string }): Promise<StepResult<void>>` — usado al dar de alta un repositorio: verifica que sea un repositorio Git con remoto `origin` y que la rama base exista en el remoto.
  - `GitManager.createBranch(input: { repoLocalPath: string; branchName: string; baseBranch: string }): Promise<StepResult<{ branchName: string; baseBranch: string; alreadyExisted: boolean }>>` — los cambios pendientes se reportan como `ErrorBloqueante('CambiosPendientes')` con la lista de archivos en `message`.

- **Criterios de Aceptación Técnicos:**
  1. (CA3 original) `GitManager` (sobre repositorios Git temporales): repo inexistente → `ErrorBloqueante('RepositorioNoEncontrado')`; cambios pendientes → `ErrorBloqueante('CambiosPendientes')` sin ejecutar pull ni creación; rama ya existente → `Ok({ alreadyExisted: true })` sin pull, creación ni cambio de rama (H-04); parado en la rama base → `git pull --ff-only origin <base>`; parado en otra rama → `git fetch origin <base>:<base>`; pull fallido → `ErrorBloqueante('PullFallido')` sin crear la rama; caso feliz → crea la rama exactamente una vez con `git switch -c <rama> <base>`; en ningún path se ejecuta `commit`, `add` ni `push` (verificable con spy sobre el runner de comandos Git).

- **Definition of Done (DoD):**
  - [ ] `GitManager` no ejecuta `commit`, `add` ni `push` en ningún path de código.
  - [ ] Hay al menos un test para `Ok` y para cada subtipo de `ErrorBloqueante` que produce.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---

#### TK-02d: FileSystem Manager y plantillas de documento

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 2 (4.º) | **Esfuerzo:** Medio
- **Dependencias Previas:** TK-02a
- **Historias de Usuario Relacionadas:** US-03

- **Descripción y Alcance:**
  Crea `<raíz>\ID\<repositorio>\adjuntos\` y el documento **fuera del repositorio Git**; documento en dos fases con idempotencia de Fase 1; guarda y lee `ID\.devflow\fase1.json` para la reutilización; renderiza con Handlebars la plantilla del tipo (ADR-004.1). Sin repositorio (clave sin repositorios) crea solo el documento.

- **Archivos a Crear / Modificar:**
  - `src/services/filesystem/filesystem-manager.ts`
  - `src/database/local-file-storage.ts` *(ambiguo: `002-arquitectura-del-sistema.md` §2.2 describe el "Local File Storage" como parte de la Storage Layer; se ubica junto a `sqlite-storage-manager.ts` por pertenecer ambos a la Storage Layer)*
  - `templates/documents/{bug.md.hbs, historia.md.hbs}`
  - `tests/unit/services/filesystem/*.test.ts` (directorios temporales)

- **Contratos e Interfaces (Input/Output):**
  - `FileSystemManager.createTicketWorkspace(input: { ticketId: string; repositoryName?: string; ticketsRootPath: string; adjuntosDirName: string }): Promise<StepResult<{ folderPath: string }>>`
  - `FileSystemManager.readFase1(ticketId: string): Promise<StepResult<DocumentoFase1 | null>>` / `saveFase1(ticketId: string, fase1: DocumentoFase1): Promise<StepResult<void>>`
  - `FileSystemManager.writeDocument(input: { documentPath: string; tipo: 'bug' | 'historia'; fase1: DocumentoFase1 | { rawText: string }; repo?: string; rama?: string; regenerateFase1Only: boolean }): Promise<StepResult<{ documentPath: string }>>`
  - `DocumentoFase1` es el tipo que produce TK-02e; en este ticket se define su interfaz mínima (ver TK-02e) para no bloquear el desarrollo en paralelo *(asumido: el tipo vive en `src/shared/types/`)*.

- **Criterios de Aceptación Técnicos:**
  1. (CA4 original) `FileSystemManager`: re-ejecutar sobre un ticket ya iniciado regenera solo el bloque de Fase 1 (delimitado por los marcadores `<!-- DEVFLOW:FASE1:INICIO -->` / `<!-- DEVFLOW:FASE1:FIN -->`), preservando intacto el contenido de Fase 2 ya escrito por el desarrollador; ejecutar el mismo ticket con un segundo repositorio crea una carpeta y un documento propios y copia la Fase 1 guardada en `fase1.json`.

- **Definition of Done (DoD):**
  - [ ] Ningún archivo se crea dentro del repositorio Git del desarrollador.
  - [ ] Un documento renderizado con `{ rawText }` lleva el aviso `⚠️ Generado sin Ollama`.
  - [ ] Hay al menos un test para `Ok` y para `ErrorBloqueante('PermisosInsuficientes')`.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---

#### TK-02e: Ollama AI Transformer (prompts, schemas y posprocesado)

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 2 (5.º) | **Esfuerzo:** Medio-Alto
- **Dependencias Previas:** TK-02a
- **Historias de Usuario Relacionadas:** US-03

- **Descripción y Alcance:**
  Arma el prompt con los archivos de `templates/prompts/` según el tipo de issue; invoca Ollama local con *streaming* y el JSON Schema del tipo en `format`; valida con Ajv —el JSON Schema es la fuente de verdad, no Zod—; aplica el posprocesado determinista `siFalta` / `verificarLiterales`; cualquier respuesta inválida, con código embebido, o timeout/no disponible cae a `FallbackDeterminista` (ADR-003.1). Modelo mínimo `qwen2.5:3b`, `ollama_timeout_seconds` = 120 y `keep_alive` corto, todo por constructor.

- **Archivos a Crear / Modificar:**
  - `src/services/ollama/ollama-ai-transformer.ts`
  - `src/services/ollama/postprocess.ts` *(asumido: nombre del módulo del posprocesado determinista)*
  - `templates/prompts/{comun.system.md, bug.system.md, historia.system.md, ticket.user.md, bug.schema.json, historia.schema.json}`
  - `tests/unit/services/ollama/*.test.ts` (Ollama simulado con msw)

- **Contratos e Interfaces (Input/Output):**
  - `OllamaAITransformer.processContext(ctx: ContextoTicket, tipo: 'bug' | 'historia', onToken?: (chars: number) => void): Promise<StepResult<DocumentoFase1>>` — `DocumentoFase1` es la respuesta del JSON Schema del tipo, ya posprocesada, más `generatedByOllama: boolean` y `promptVersion: string`. Ambos schemas empiezan por `presenteEnTicket` y incluyen `resumen`, `escenarios[] { titulo, given, when, then }` y `preguntasAbiertas[]`; el de **bug** suma `pasosParaReproducir[]`, `comportamientoEsperado`, `comportamientoActual` y `entorno`; el de **historia**, `historiaUsuario { como, quiero, para }` y `casosDeUso[]`. Sin bloques de código.

- **Criterios de Aceptación Técnicos:**
  1. (CA2 original) `OllamaAITransformer`: JSON válido contra el schema del tipo → `Ok`; JSON con un bloque de código Markdown embebido (fenced code block) → `FallbackDeterminista` (verifica el Non-Goal "cero código generado" del PRD); sin respuesta dentro de `ollama_timeout_seconds` → `FallbackDeterminista`. El posprocesado sobrescribe con "No especificado en el ticket." los campos marcados como ausentes en `presenteEnTicket` y agrega la pregunta abierta; en bugs descarta literales ausentes del ticket (verificable con los fixtures escuetos de TK-02a).

- **Definition of Done (DoD):**
  - [ ] Al cambiar un prompt o un schema se sube `promptVersion` del tipo en `templates/issue-types.json`.
  - [ ] Hay al menos un test para `Ok` y para `FallbackDeterminista`.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---

#### TK-02f: Orquestador — flujo `startTicket` y registro en `ticket_logs`

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 2 (6.º) | **Esfuerzo:** Alto
- **Dependencias Previas:** TK-02b, TK-02c, TK-02d, TK-02e
- **Historias de Usuario Relacionadas:** US-02, US-03

- **Descripción y Alcance:**
  **Orquestador de Ticket**: coordina Jira → Git → FileSystem → Ollama → FileSystem para **un repositorio por ejecución**, emitiendo un evento de progreso por paso (Decisión 1 de la auditoría); resuelve el tipo de issue con `templates/issue-types.json` y corta el flujo en las épicas; reutiliza la Fase 1 entre repositorios del mismo ticket; es el **único escritor de `ticket_logs`** (Decisión 4), con *upsert* por `(ticket_id, repository_id)` y tratamiento aparte de `repository_id = NULL`; registra `prompt_version`. Recibe los cuatro pasos y el `SQLiteStorageManager` por constructor.

- **Archivos a Crear / Modificar:**
  - `src/services/orchestrator/ticket-orchestrator.ts`
  - `tests/unit/services/orchestrator/*.test.ts`
  - `tests/integration/ticket-flow.e2e.test.ts`

- **Contratos e Interfaces (Input/Output):**
  - `type AskRequest = { kind: 'manualTicket'; ticketId: string; reason: 'network_timeout' | 'invalid_token' | 'not_found' } | { kind: 'confirmActions'; summary: { ticketId: string; issueType: string; repositoryName: string | null; branchName: string | null; baseBranch: string | null; folderPath: string } }` y `type AskCallback` con dos formas: `manualTicket` → `Promise<{ title: string; description: string }>` y `confirmActions` → `Promise<boolean>` — único punto en el que el Orquestador pide datos o una decisión al usuario durante un flujo (carga manual ante `FallbackManual` de Jira, y confirmación de acciones, H-03). **La confirmación se pide una sola vez, después de obtener el ticket y resolver su tipo (ya se conoce el prefijo de la rama) y antes de tocar Git, disco u Ollama.** Si el desarrollador cancela, no se crea nada ni se escribe en `ticket_logs`. La elección del repositorio **no** se pide a mitad del flujo: la TUI la resuelve antes con `listRepositoriesForTicket` (TK-02g) y pasa `repositoryId`.
  - `TicketOrchestrator.startTicket(input: { ticketId: string; repositoryId?: number; baseBranchOverride?: string; reprocessFase1?: boolean }, hooks: { onStep: (step: 'jira' | 'git' | 'filesystem' | 'ollama', status: 'started' | 'ok' | 'fallback' | 'error', detail?: string) => void; ask: AskCallback }): Promise<TicketRunSummary>` — `TicketRunSummary { ticketId: string; repositoryId: number | null; issueType: string; branchName: string | null; branchStatus: 'created' | 'already_existed' | 'pending_changes' | 'error' | null; folderPath: string | null; documentPath: string | null; jiraFetchStatus: 'ok' | 'fallback_manual'; ollamaStatus: 'ok' | 'fallback_deterministic' | 'reused' | null; promptVersion?: string; blocked?: { subtype: string; message: string }; cancelled?: true }` — `cancelled` es `true` solo si el desarrollador no confirmó (en ese caso `branchName`, `folderPath`, `documentPath` y `ollamaStatus` son `null`); `folderPath`, `documentPath` y `ollamaStatus` son `null` cuando el flujo se cortó en Git; el Orquestador igualmente registra la ejecución en `ticket_logs`.

- **Criterios de Aceptación Técnicos:**
  1. (CA5 original, más H-03 y H-02) Test de integración del Orquestador: `reprocessFase1: true` con una Fase 1 válida previa → invoca a Ollama, sobrescribe `fase1.json` y regenera solo el bloque de Fase 1 del documento del repositorio elegido (sin tocar la Fase 2 ni los documentos de otros repositorios); si el reproceso cae en fallback conserva la Fase 1 válida anterior; sin el flag y con una Fase 1 previa en fallback (`generatedByOllama: false`) reintenta con Ollama automáticamente; confirmación rechazada (`ask` devuelve `false`) → resumen con `cancelled: true`, sin llamadas a Git, FileSystem ni Ollama y sin fila en `ticket_logs`; ejecución cortada por cambios pendientes → resumen con `blocked`, `folderPath`/`documentPath`/`ollamaStatus` en `null` y una fila en `ticket_logs` con `branch_status = 'pending_changes'`; Jira fallback → se invoca `ask({ kind: 'manualTicket' })` y el flujo continúa con los datos devueltos; Jira OK + Ollama OK → rama + carpeta + documento + un único registro en `ticket_logs` (SQLite mockeada) con `prompt_version`; Jira fallback + Ollama fallback → el flujo completa igual sin detenerse, documento marcado `⚠️ Generado sin Ollama`; épica → aviso sin rama, carpeta, documento ni registro; segunda ejecución con otro repositorio → `ollamaStatus: 'reused'` sin invocar a Ollama; clave sin repositorios → solo documento, `repositoryId: null` y sin pasos de Git.

- **Definition of Done (DoD):**
  - [ ] Solo el Orquestador escribe `ticket_logs`.
  - [ ] Los 4 tipos de `StepResult` tienen al menos un test en el Orquestador que los maneja.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---

#### TK-02g: Orquestador — gestión de configuración, proyectos y repositorios para la TUI

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 2 (7.º) | **Esfuerzo:** Medio
- **Dependencias Previas:** TK-02b, TK-02c
- **Historias de Usuario Relacionadas:** US-01, US-02

- **Descripción y Alcance:**
  Métodos del Orquestador que la TUI usa fuera del flujo `startTicket`, para que no acceda a Jira, Git ni SQLite (US-01). Validan contra Jira (`validateProjectKey`) y contra Git (`validateRepository`) al dar de alta, y traducen el error `FOREIGN KEY constraint failed` al quitar un proyecto o repositorio con historial a un mensaje claro (hallazgo de TK-01).

- **Archivos a Crear / Modificar:**
  - `src/services/orchestrator/ticket-orchestrator.ts` (modificar; o un módulo de gestión separado si el archivo crece *(asumido)*)
  - `tests/unit/services/orchestrator/*.test.ts`

- **Contratos e Interfaces (Input/Output):**
  - `TicketOrchestrator.listAssignedTickets(): Promise<StepResult<Array<{ ticketId: string; title: string; issueType: string }>>>` — usa las claves dadas de alta.
  - `TicketOrchestrator.listRepositoriesForTicket(ticketId: string): StepResult<Repository[]>` — deriva la clave del ID; falla antes de llamar a Jira si la clave no está configurada, con las claves disponibles en el mensaje.
  - `TicketOrchestrator.listProjects(): JiraProject[]` / `addProject(key: string): Promise<StepResult<JiraProject>>` (valida contra Jira) / `removeProject(key: string): void`
  - `TicketOrchestrator.addRepository(input: { jiraProjectKey: string; name: string; repoLocalPath: string; defaultBaseBranch?: string }): Promise<StepResult<Repository>>` (valida con `GitManager.validateRepository`) / `updateRepository(...)` / `removeRepository(repositoryId: number): void`
  - `TicketOrchestrator.suggestBranchSuffix(): Promise<StepResult<string>>` (desde el `displayName` de `/myself`) / `getConfig(): AppConfig | null` / `saveConfig(config: Partial<AppConfig>): void`

- **Criterios de Aceptación Técnicos** *(derivados del contrato de la TUI del ticket original; no tenían CA numerado)*:
  1. `addProject` y `addRepository` solo persisten si la validación externa devuelve `Ok`; ante `FallbackManual` o `ErrorBloqueante` no escriben nada y devuelven el resultado.
  2. `listRepositoriesForTicket` con una clave no configurada devuelve un error con las claves disponibles, sin llamar a Jira.
  3. `removeProject` / `removeRepository` con historial en `ticket_logs` lanzan o devuelven un error con un mensaje claro, no el texto crudo de SQLite.

- **Definition of Done (DoD):**
  - [ ] La TUI (TK-03a) puede cubrir todo US-01 usando solo estos métodos.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---

### TK-03: Controlador CLI e Interfaz Interactiva de Terminal (Windows) (ticket paraguas dividido en TK-03a y TK-03b)

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 3 | **Esfuerzo total:** Medio-Alto
- **Dependencias Previas:** TK-01, TK-02f, TK-02g (el TK-02 original se dividió; ver la tabla en TK-02)
- **Capa / Módulo:** Frontend / TUI (TUI Layer)
- **Historias de Usuario Relacionadas:** US-01, US-02, US-03

> **División (2026-11-02).** El TK-03 original (dos comandos, cuatro prompts de flujo, uno de alta y tres vistas) era demasiado grande para un contrato de 2-3 escenarios y 5 tareas, y obligaba a esperar al Orquestador completo (TK-02f) para entregar nada. Se divide en dos sub-tickets, cada uno con su propio contrato en `docs/changes/TK-03x.md`. **TK-03 deja de implementarse como unidad**: es solo el paraguas; se considera cerrado cuando TK-03a y TK-03b lo están. Los criterios técnicos originales CA1-CA9 se conservan dentro del sub-ticket que los cubre.

| Sub-ticket | Alcance | CA originales | Esfuerzo | Depende de |
|---|---|---|---|---|
| **TK-03a** | CLI base (`cli.ts`) y `devflow config` / `devflow config proyectos` con sus prompts de alta | CA9 | Medio | TK-02g |
| **TK-03b** | `devflow start`: selección de ticket y repositorio, carga manual, confirmación, progreso y pantallas de resultado | CA1-CA8 | Medio-Alto | TK-02f, TK-03a |

Orden: TK-03a (Hito 1, ya con TK-02g) → TK-03b (Hito 2, con TK-02f).

**Reglas comunes a ambos sub-tickets:** **sin Ink** (Ink e inquirer compiten por stdin); la TUI nunca accede directamente a Jira, Git, Ollama, SQLite o al sistema de archivos — todo pasa por el Orquestador; la comunicación es asíncrona basada en eventos, no una llamada bloqueante única (Decisión 1 de la auditoría de arquitectura).

---

#### TK-03a: CLI base y comando `devflow config`

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 3 (1.º) | **Esfuerzo:** Medio
- **Dependencias Previas:** TK-02g
- **Historias de Usuario Relacionadas:** US-01

- **Descripción y Alcance:**
  Punto de entrada de línea de comandos con Commander (`cli.ts`, que también instancia el Orquestador con la ruta de la base) y el comando `devflow config`: propone el sufijo de usuario sugerido desde Jira, que el usuario confirma o edita, y, con `devflow config proyectos`, permite agregar, listar, editar y quitar claves de proyecto y repositorios (con su rama base) mediante prompts de `@inquirer/prompts`. Traduce a mensajes claros los errores del Orquestador (p. ej. el borrado con historial, pendiente desde TK-01). Los flags y subcomandos concretos se fijan al refinar este ticket (H-06).

- **Archivos a Crear / Modificar:**
  - `src/tui/cli.ts`
  - `src/tui/commands/config.command.ts` *(nombres decididos el 2026-11-02, H-06: `devflow config` y `devflow config proyectos`; ningún documento base los definía, y sin ellos las tablas de configuración no podrían poblarse nunca)*
  - `src/tui/prompts/project-config.prompt.ts`
  - `tests/unit/tui/*.test.ts`

- **Contratos e Interfaces (Input/Output):**
  - Entrada: `devflow config` y `devflow config proyectos`; usa solo los métodos de gestión del Orquestador definidos en TK-02g.

- **Criterios de Aceptación Técnicos:**
  1. `devflow config proyectos` permite agregar una clave (validada por el Orquestador), asociarle repositorios con su rama base y quitar claves o repositorios; y `devflow config` propone el sufijo de usuario sugerido desde Jira, que el usuario confirma o edita. *(CA9 del TK-03 original)*

- **Definition of Done (DoD):**
  - [ ] La TUI no importa clientes de Jira/Git/Ollama ni el storage manager — solo invoca al Orquestador (verificable por revisión de imports).
  - [ ] Los nombres `devflow config` y `devflow config proyectos` están decididos (H-06); los flags y subcomandos concretos se fijan al refinar este ticket y se validan antes de cerrarlo.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---

#### TK-03b: Comando `devflow start` (selección, confirmación, progreso y pantallas de resultado)

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 3 (2.º) | **Esfuerzo:** Medio-Alto
- **Dependencias Previas:** TK-02f, TK-03a
- **Historias de Usuario Relacionadas:** US-02, US-03

- **Descripción y Alcance:**
  Comando `devflow start [ID] [--base <rama>] [--reprocesar]` (registrado en el `cli.ts` de TK-03a): parsing/validación del ID antes de invocar al Orquestador, prompts interactivos (elección de ticket en la lista de asignados, elección de repositorio —preseleccionado si la clave tiene uno solo—, carga manual de datos de Jira ante `FallbackManual`, confirmación única de acciones) y progreso en vivo mediante un spinner simple que consume los eventos `onStep` del Orquestador (TK-02f), incluido el progreso del *streaming* de Ollama. Incluye las pantallas de resultado final y las de aviso de `FallbackManual` / `FallbackDeterminista` / `ErrorBloqueante` (listado de cambios pendientes, fallo del pull, aviso de épica), cada una con un mensaje distinguible.

- **Archivos a Crear / Modificar:**
  - `src/tui/cli.ts` *(modificar: registrar `start`)*
  - `src/tui/commands/start.command.ts`
  - `src/tui/prompts/ticket-selection.prompt.ts`
  - `src/tui/prompts/repository-selection.prompt.ts`
  - `src/tui/prompts/manual-ticket-entry.prompt.ts`
  - `src/tui/prompts/confirm-actions.prompt.ts`
  - `src/tui/views/progress-view.ts`
  - `src/tui/views/summary-view.ts`
  - `src/tui/views/fallback-view.ts`
  - `tests/unit/tui/*.test.ts`

- **Contratos e Interfaces (Input/Output):**
  - Entrada: `devflow start [TICKET_ID] [--base <rama>] [--reprocesar]` (el flag se pasa como `reprocessFase1` y se muestra en la confirmación) → sin `TICKET_ID`, la TUI obtiene la lista con `TicketOrchestrator.listAssignedTickets()` y presenta `TicketSelectionPrompt`; con el ID resuelto, obtiene los repositorios con `listRepositoriesForTicket(ticketId)`, presenta `RepositorySelectionPrompt` si hay más de uno y llama a `TicketOrchestrator.startTicket({ ticketId, repositoryId, baseBranchOverride }, { onStep, ask })` (contratos definidos en TK-02), donde `ask` abre `ManualTicketEntryPrompt`.
  - `onStep(step: 'jira' | 'git' | 'filesystem' | 'ollama', status: 'started' | 'ok' | 'fallback' | 'error', detail?: string): void` y `ask: AskCallback` (TK-02f)
  - `TicketSelectionPrompt.ask(tickets: Array<{ ticketId: string; title: string; issueType: string }>): Promise<string>`
  - `RepositorySelectionPrompt.ask(repositories: Array<{ id: number; name: string; repoLocalPath: string }>): Promise<number>`
  - `ManualTicketEntryPrompt.ask(): Promise<{ ticketId: string; title: string; description: string }>`
  - `ConfirmActionsPrompt.ask(summary: { ticketId: string; issueType: string; repositoryName: string | null; branchName: string | null; baseBranch: string | null; folderPath: string }): Promise<boolean>` — una única confirmación consolidada (decidido en H-03, 2026-11-02): la TUI la muestra cuando el Orquestador invoca `ask({ kind: 'confirmActions' })` y devuelve `false` si el desarrollador cancela
  - `SummaryView.render(result: TicketRunSummary): void`
  - `isValidTicketId(input: string): boolean` — formato `<CLAVE>-<número>` (`^[A-Z][A-Z0-9_]+-\d+$`).

- **Criterios de Aceptación Técnicos:**
  1. `devflow start` con un ID de formato inválido (vacío o sin guion) no invoca al Orquestador y muestra un mensaje de validación; con un ID de una clave no configurada, muestra el mensaje del Orquestador con las claves disponibles.
  2. `devflow start` sin ID muestra la lista de tickets asignados que devuelve el Orquestador y continúa con el elegido (mock del Orquestador).
  3. Al invocar el Orquestador el callback `ask({ kind: 'manualTicket' })`, la TUI abre `ManualTicketEntryPrompt` con el motivo del fallo y devuelve los datos ingresados al flujo (mock del Orquestador); `onStep('jira', 'fallback')` actualiza además el spinner.
  4. Antes de llamar a `startTicket`: si la clave del ticket tiene varios repositorios, la TUI pide elegir uno; con uno solo lo preselecciona; sin repositorios no muestra la selección y no pasa `repositoryId`.
  5. Al invocar el Orquestador `ask({ kind: 'confirmActions' })`, la TUI muestra el resumen (rama, base, carpeta) en una sola pantalla y devuelve `true` o `false`; con `false` no se muestra progreso de pasos y se informa que la ejecución fue cancelada sin cambios (mock del Orquestador). *(H-03)*
  6. Al recibir eventos de progreso sucesivos (`started` → `ok` por paso), la vista de progreso actualiza el estado de cada paso sin bloquear el hilo principal.
  7. Al finalizar con `ollamaStatus: 'fallback_deterministic'`, `SummaryView` muestra explícitamente el aviso `⚠️ Generado sin Ollama`; con `'reused'`, indica que se reutilizó el análisis del ticket.
  8. Al recibir un resumen con `blocked` (`RepositorioNoEncontrado`, `CambiosPendientes` con la lista de archivos, `PullFallido`, `TipoIssueBloqueado`), la TUI muestra el mensaje correspondiente y no renderiza una pantalla de éxito.

- **Definition of Done (DoD):**
  - [ ] La TUI no importa clientes de Jira/Git/Ollama ni el storage manager — solo invoca al Orquestador (verificable por revisión de imports).
  - [ ] Los 4 estados de resultado tienen una pantalla/mensaje distinguible para el usuario.
  - [ ] Progreso en vivo (spinner) funcional sin llamada bloqueante única y sin dependencia de Ink.
  - [ ] Revisión de código aprobada y mergeada a la rama del ticket.

---
