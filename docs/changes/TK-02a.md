# Change: TK-02a — Base compartida de la Service Layer (resultado de paso, configuración, tipo de issue y fixtures)

- **Estado:** Implementado
- **Fuente:** `docs/006-tickets-de-trabajo.md` (TK-02a)
- **Depende de:** TK-01
- **INVEST:** Cumple (I, S y T evaluadas). Nota sobre S: son 4 criterios más 2 puntos de DoD (fixtures y cobertura); se agrupan en 3 escenarios y 5 tareas.

## Propósito

Define lo que comparten los demás sub-tickets de TK-02: el contrato `StepResult`, el proveedor de configuración inmutable, el resolutor de tipo de issue (`templates/issue-types.json`), los fixtures de tickets Jira v2 y la regla de lint que restringe quién importa `sqlite-storage-manager.ts`.
Permite que TK-02b … TK-02g avancen en paralelo sobre una base común, y deja configurado el umbral de cobertura del 80 % de la Service Layer.

## Criterios de aceptación de origen

- CA1: los 4 tipos de `StepResult` están definidos y son discriminables por `kind` (verificado por el compilador y por un test de tipos o de estrechamiento).
- CA2: el resolutor clasifica Epic/Épica como bloqueada, Bug/Error/Defecto como `bug` y cualquier otro tipo como `historia`, con el prefijo de rama y la `promptVersion` del tipo leídos de `templates/issue-types.json`.
- CA3: el proveedor de configuración rechaza una configuración con campos obligatorios ausentes y completa los valores por defecto; es inmutable y se inyecta por constructor.
- CA4: `npm run lint` falla si un archivo distinto del Orquestador (o de los tests) importa `src/database/sqlite-storage-manager.ts`.
- DoD-a: los fixtures cubren bug y historia (completos y escuetos) y una épica.
- DoD-b: umbral de cobertura del 80 % configurado en `vitest.config.ts` para la Service Layer y registrado en este contrato (cierra la casilla abierta de TK-01).

## Escenarios BDD

### E1 — Resultado de paso discriminable y tipo de issue resuelto desde la plantilla (cubre: CA1, CA2, DoD-a)

- **Given** los fixtures de tickets Jira v2 (bug y historia, completos y escuetos, y una épica) y `templates/issue-types.json`
- **When** se resuelve el tipo de issue de cada fixture (`Epic`/`Épica`, `Bug`/`Error`/`Defecto`, y tipos como `Story`, `Historia` o `Tarea`) y se estrecha el `StepResult` devuelto por su `kind`
- **Then** la épica devuelve `ErrorBloqueante('TipoIssueBloqueado')`, los tipos de bug devuelven `Ok({ tipo: 'bug', … })`, cualquier otro tipo devuelve `Ok({ tipo: 'historia', … })`, el `branchType` (`bugfix` para bug, `feature` para historia) y la `promptVersion` coinciden con los de `templates/issue-types.json`, y el compilador acepta el estrechamiento por `kind` en los 4 tipos de `StepResult`

### E2 — Configuración inmutable con validación y valores por defecto (cubre: CA3)

- **Given** una configuración parcial con los campos obligatorios presentes y otra con alguno ausente
- **When** se construye el proveedor de configuración con cada una y se intenta modificar el resultado
- **Then** la incompleta es rechazada indicando los campos que faltan, la completa se acepta con los valores por defecto aplicados (incluida la ruta de la base de datos), y la configuración devuelta es inmutable

### E3 — Regla de lint: solo el Orquestador importa el storage manager (cubre: CA4)

- **Given** la configuración de ESLint del repositorio
- **When** se analiza un archivo de `src/services/jira/`, de `src/tui/` y de `src/services/orchestrator/` que importan `sqlite-storage-manager`, y un test que lo importa
- **Then** los dos primeros producen error de `no-restricted-imports`, y el del Orquestador y el test no producen ninguno

## Trazabilidad

| Escenario | Criterios cubiertos | Test | Estado |
|---|---|---|---|
| E1 | CA1, CA2, DoD-a | `tests/unit/services/orchestrator/issue-type-resolver.test.ts` (fixtures, épica, bug y historia por nombre) y `tests/unit/shared/step-result.test.ts` (estrechamiento de los 4 `kind`; el chequeo exhaustivo lo hace `npm run typecheck`) | Hecho |
| E2 | CA3 | `tests/unit/shared/app-config.provider.test.ts` (15 casos: defaults, valores explícitos, 4 obligatorios ausentes, vacíos, sufijo inválido, sin variables de entorno, inmutabilidad, copia defensiva, `resolveDatabasePath`) | Hecho |
| E3 | CA4 | `tests/unit/lint-rules.test.ts` › «E3 — solo el Orquestador importa sqlite-storage-manager» (4 casos que violan la regla, 2 permitidos). Comprobado además a mano: un archivo temporal en `src/services/jira/` hizo fallar `npm run lint` y se borró | Hecho |

DoD-b (cobertura) no es un escenario: se verifica ejecutando el comando de cobertura (ver tarea 4) y se registra el resultado en "Decisiones y desvíos".

## Prerrequisitos

- Dependencia de desarrollo `@vitest/coverage-v8` (versión compatible con `vitest ^5.0.5`): **no está en `package.json`** y se necesita para el umbral del 80 %. Requiere `npm install` con red; `/04-tdd-pair` no la instala por su cuenta, hay que aprobarlo.
- Scaffold de TK-00 (`package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`): **existe**, verificado.

## Archivos afectados

| Ruta | Acción |
|---|---|
| `src/shared/errors/result.types.ts` | Crear (propuesta): `StepResult<T>` |
| `src/shared/types/ticket-context.types.ts` | Crear (propuesta, _asumido_: ubicación de `ContextoTicket`; el ticket no la fija) |
| `src/shared/config/app-config.provider.ts` | Crear (propuesta) |
| `src/services/orchestrator/issue-type-resolver.ts` | Crear (propuesta) |
| `templates/README.md`, `templates/issue-types.json` | Crear (propuesta) |
| `tests/fixtures/tickets/*.json` | Crear (propuesta): bug y historia completos y escuetos, y una épica |
| `tests/unit/services/orchestrator/issue-type-resolver.test.ts` | Crear (propuesta) |
| `tests/unit/shared/app-config.provider.test.ts` | Crear (propuesta) |
| `tests/unit/lint-rules.test.ts` | Modificar (existente): casos de la regla del storage manager |
| `eslint.config.js` | Modificar (existente): nueva restricción de importación; el bloque de `src/tui/**` debe repetirla porque una regla de un bloque posterior reemplaza a la anterior |
| `vitest.config.ts` | Modificar (existente): cobertura con umbral del 80 % en `src/services/**` |
| `package.json` | Modificar (existente): dependencia `@vitest/coverage-v8` y script de cobertura _(ambiguo, ver abajo)_ |

## Tareas

- [x] 1. E1 — RED: tests del resolutor con los fixtures; GREEN: `result.types.ts`, `ticket-context.types.ts`, `templates/issue-types.json`, `templates/README.md`, `issue-type-resolver.ts` y los fixtures
- [x] 2. E2 — RED: tests del proveedor de configuración; GREEN: `app-config.provider.ts`
- [x] 3. E3 — RED: casos nuevos en `lint-rules.test.ts` (uno que viola la regla); GREEN: regla en `eslint.config.js`
- [x] 4. DoD-b — instalar `@vitest/coverage-v8`, configurar el umbral del 80 % en `vitest.config.ts` y el script, y registrar el resultado
- [x] 5. Refactor, TSDoc en español de los exports públicos, `npm run typecheck`, `npm run lint` y `npm test` en verde

## Decisiones y desvíos

Pendientes de confirmar con el desarrollador (marcadas _(ambiguo)_ o _(asumido)_; se mueven aquí con su respuesta al aprobar):

- **Forma del resolutor (decidido por el desarrollador, opción B):** `resolveIssueType(issueType: string): StepResult<{ tipo: 'bug' | 'historia'; branchType: 'feature' | 'bugfix'; promptVersion: string }>`. El resolutor no devuelve el texto del prefijo. La comparación del nombre del tipo ignora mayúsculas, acentos y espacios sobrantes (Jira devuelve `Epic` o `Épica` según el idioma del sitio); los nombres reconocidos viven en `templates/issue-types.json`.
- **Prefijo de rama (decidido por el desarrollador, opción B):** una sola fuente de verdad. El resolutor devuelve solo `branchType` (coincide con `TicketLogEntry.branchType`) y el Orquestador (TK-02f) arma el prefijo con `AppConfig.branchPrefixFeature` / `branchPrefixBugfix`. `templates/issue-types.json` no contiene prefijos. **Desvío respecto a `docs/006`:** el contrato del resolutor en TK-02a dice `prefijoRama: 'features' | 'bugs'` y su CA2 habla de «prefijo de rama … leído de `templates/issue-types.json`»; hay que actualizar `006` (TK-02a y, donde corresponda, TK-02f) antes de implementar. Aplicado después en `docs/006` (commit de refinamiento de TK-02a).
- _(asumido)_ **`promptVersion` inicial:** `bug-v1` y `historia-v1`. Los ejemplos `bug-v3` / `historia-v2` de `docs/003` son ilustrativos; los prompts reales llegan en TK-02e.
- _(asumido)_ **Alcance de `issue-types.json`:** solo el mapeo tipo → plantilla, `branchType`, `promptVersion` y tipos bloqueados. Las «reglas de datos ausentes» que menciona `docs/002` §2.3 son del posprocesado de Ollama (TK-02e) y quedan fuera.
- _(ambiguo)_ **Campos obligatorios de la configuración:** propuesta `jiraBaseUrl`, `jiraEmail`, `jiraApiToken` y `branchUserSuffix` (formato `^[A-Z0-9]+$`). Con valor por defecto: `jiraTimeoutSeconds` 10, `ollamaHost` `http://localhost:11434`, `ollamaModel` `qwen2.5:3b`, `ollamaTimeoutSeconds` 120, `branchPrefixFeature` `features`, `branchPrefixBugfix` `bugs`, `adjuntosDirName` `adjuntos` y `ticketsRootPath` `%USERPROFILE%\DevFlowCLI\tickets` (en `docs/003` es `NOT NULL` sin default, pero la aplicación lo propone al configurar).
- _(ambiguo)_ **Ruta de la base de datos:** no forma parte de `AppConfig` (hace falta antes de poder leerla). Propuesta: función `resolveDatabasePath` en el mismo módulo, que usa `APPDATA` y recibe el entorno inyectado para poder probarla en WSL.
- _(asumido)_ **Cómo rechaza el proveedor:** lanza un `Error` con la lista de campos ausentes o inválidos (ningún subtipo de `ErrorBloqueante` encaja con una configuración inválida, y es un error de arranque, no de un paso).
- _(asumido)_ **Cobertura:** `coverage.include` limitado a `src/services/**`, umbral del 80 % en líneas, funciones, ramas y sentencias; comando `npm run test:coverage`. `npm test` no cambia de comportamiento.

Registro de la implementación (2026-11-02):

- **Dependencia aprobada:** el desarrollador autorizó `npm install -D @vitest/coverage-v8`. npm resolvió `@vitest/coverage-v8@5.1.0` y subió `vitest` de 5.0.5 a 5.1.0 (deduplicado, dentro del rango `^5.0.5`). `package.json` y `package-lock.json` cambian en consecuencia. `npm audit` informa 10 vulnerabilidades moderadas, todas bajo `typescript-eslint` / `minimatch`; no se tocaron.
- **Cobertura (DoD-b):** umbral del 80 % en líneas, funciones, ramas y sentencias, limitado a `src/services/**` y aplicado solo con `npm run test:coverage` (`npm test` no cambia). Resultado actual: 100 % (solo existe `issue-type-resolver.ts`). Verificado que el umbral se hace cumplir: con `--coverage.thresholds.lines=101` el comando falla con código 1.
- **Escritura fuera de `src/` y `tests/`:** el desarrollador autorizó tocar `templates/`, `eslint.config.js`, `vitest.config.ts` y `package.json`, que el contrato lista en «Archivos afectados».
- **`databasePath` dentro de la configuración efectiva:** `AppConfigProvider` lo incluye en `ResolvedAppConfig` (con `resolveDatabasePath` exportada también), para que quien instancia el `SQLiteStorageManager` lo tome de ahí. Si falta `USERPROFILE` / `APPDATA` y no hay valor explícito, el constructor lanza.
- **Resolutor:** lee `templates/issue-types.json` una sola vez al cargar el módulo; no recibe la plantilla por parámetro.
- **Regla de lint:** busca `sqlite-storage-manager` en la ruta del import; una reexportación desde otro archivo no se detectaría (hoy no existe ninguna).
- **Pendiente fuera del contrato:** la casilla «Umbral de cobertura» del DoD de TK-01 en `docs/006` y `docs/changes/TK-01.md` sigue abierta; hay que cerrarla (la skill no permite editar esos documentos).

Ajustes tras la revisión de la PR (2026-11-03, aprobados por el desarrollador):

- **Aplicados con TDD:** (1) una ruta en blanco (`ticketsRootPath`, `databasePath`) cuenta como ausente: toma el valor por defecto o falla si no hay variable de entorno; (2) el bloque de `src/tui/**` en `eslint.config.js` repite `storageManagerOnlyInOrchestrator`, de modo que un import como `./sqlite-storage-manager.js` sin pasar por `database/` también se rechaza; (3) los textos de la configuración se guardan recortados y un opcional en blanco toma su valor por defecto. Se añadieron 6 tests (96 en total).
- **Registrados sin cambio de código:** (4) `resolveIssueType` devuelve `historia` para un tipo vacío o desconocido, por la política «el resto → historia»; si Jira devolviera un tipo en blanco, se tratará en TK-02b. (5) El resolutor carga `templates/issue-types.json` con `readFileSync` relativo al módulo: fallará si el código se emite a `dist/` sin copiar `templates/`; revisarlo en TK-03, cuando exista el punto de entrada y el empaquetado.
