# Retrospección — Secuencia de prompts para reconstruir la Entrega 2

> Resultado de la retrospección del 2026-10-28 sobre la sesión de validación pre-código (2026-10-02/03), registrada en `VALIDACION-PRE-CODIGO.md`. Contiene una secuencia ordenada de prompts para rehacer el camino de forma limpia, desde la Entrega 1 (`feature/entrega-1-ANR`, commit `48952cf`), con las lecciones aprendidas ya incorporadas.

## Estado de partida

- `rama-prueba` (commit `f6759f1 Analisis de Jira, Ollama`) contiene `VALIDACION-PRE-CODIGO.md`, las plantillas, los prompts y los fixtures validados. Queda **como referencia**: varios pasos la consultan con `git show` / `git checkout rama-prueba -- <ruta>` para no repetir iteraciones que ya están validadas. No se mergea.
- `feature/entrega-1-ANR` sigue en `48952cf`.

## Cómo usar esta secuencia

- **El Paso 1 escribe las reglas técnicas en `CLAUDE.md`.** Claude Code lee ese archivo en cada sesión, así que los pasos siguientes ya arrancan con las restricciones cargadas. Se puede abrir una sesión nueva por paso.
- **No avanzar hasta pasar el checkpoint.** Si falla, pegar la salida en la misma sesión y pedir la corrección.
- **Sección 7 del README** (PR 2 y PR 3): PR 2 = Pasos 1–6 (docs, base del proyecto, storage, Jira) y PR 3 = Pasos 7–13 (plantillas, servicios, TUI, E2E).

## Lecciones incorporadas en los prompts

| Tropiezo en la sesión de validación | Restricción que lo previene |
|---|---|
| Jira Cloud devuelve **404 con token inválido** en `/issue` y `/project` | Ante un 404, confirmar con `/myself` (401 = token, 200 = no existe) |
| La JQL **ignora claves inexistentes** sin error | Validar cada clave con `/project/{key}` al darla de alta |
| `app_config` no tenía email ni carpeta raíz | DDL final con `jira_email`, `tickets_root_path`, `branch_user_suffix` |
| `UNIQUE` en `ticket_logs` rompía la reejecución | *Upsert* por (ticket, repo) y caso `NULL` tratado aparte |
| Timeout de 15 s inviable; el 1.5b inventaba contenido | `qwen2.5:3b`, timeout de 120 s, streaming |
| El prompt solo no frenaba alucinaciones | `presenteEnTicket` primero + posprocesado determinista en código |
| `Then` describiendo el fallo; pasos con flechas; entorno inestable | Reglas en el prompt + correcciones deterministas |
| Ink e inquirer se pisan con stdin | Sin Ink: Commander + `@inquirer/prompts` + spinner |
| Helper inexistente en Handlebars (`@index_1`) | `noEscape`, numeración automática de Markdown, test de renderizado |
| Docs que contradecían decisiones nuevas (multi-repo, Git sin pull, `devflow-cli/`) | El Paso 1 actualiza docs y `CLAUDE.md` antes de escribir código |
| Desarrollar en WSL con producto solo para Windows | Rutas resueltas por variables de entorno, override para tests, prueba final en Windows |

> ⚠️ **Decisiones asumidas y no confirmadas:** token de Jira en texto plano en SQLite, sin Ink, `node:sqlite` (Node ≥ 22.13), cobertura del 80 % y rutas por defecto `%APPDATA%\DevFlowCLI\` y `%USERPROFILE%\DevFlowCLI\tickets\`. Los prompts las dan por buenas; si alguna no sirve, cambiarla en el Paso 1 antes de empezar.

---

## Paso 0 — Preparar la rama (manual)

```bash
git switch feature/entrega-1-ANR
git pull
git switch -c feature/entrega-2-ANR
git log --oneline -1
```

**✅ Checkpoint:** el log muestra `48952cf Documentacion PR`, `git status` está limpio y `ls finalproject-ANR` dice que no existe. `rama-prueba` queda como está: no se mergea.

---

## Paso 1 — Volcar las decisiones en la documentación y fijar las reglas en CLAUDE.md

```text
Estamos en la rama feature/entrega-2-ANR, creada desde la Entrega 1 (48952cf). Todavía NO hay código.

Después de la Entrega 1 validé integraciones y tomé decisiones que están registradas en otra rama. Léelas con:
  git show rama-prueba:VALIDACION-PRE-CODIGO.md
Ese archivo contiene el historial de iteraciones; a los docs solo van las DECISIONES FINALES. No copies ese archivo a esta rama. Si contradice algo de esta lista, manda esta lista:

DECISIONES FINALES
- Jira Cloud, API REST v2 (descripción en texto plano), auth Basic email + API token. Ante un 404 en /issue o /project, llamar a /myself: 401 = token inválido, 200 = no existe. Claves de proyecto validadas con GET /rest/api/2/project/{key} al darlas de alta (la JQL ignora claves inexistentes sin error).
- Claves: el usuario da de alta una o más claves de proyecto. Cada clave tiene 0..N repositorios opcionales con nombre (backend, frontend…), ruta local y rama base (por defecto main, editable).
- Ejecución: UN repositorio por ejecución, elegido de la lista de la clave. Para varios repos se ejecuta varias veces, una tras otra. Un documento (y su carpeta adjuntos/) por ticket y repositorio. La Fase 1 de Ollama se genera una vez por ticket y se copia en el documento del siguiente repo. Una clave sin repositorios genera solo el documento, sin rama.
- `devflow start` sin ID muestra los tickets abiertos asignados al usuario en sus claves (assignee = currentUser(), statusCategory != Done, sin épicas).
- Ramas: <prefijo>/<ID>-<SUFIJO>, p. ej. features/SCRUM-1-AROCHA y bugs/SCRUM-2-AROCHA. El prefijo depende del tipo de issue. El sufijo se configura una vez y se sugiere desde el displayName de /myself (inicial del nombre + último apellido, sin acentos, en mayúsculas).
- Git Manager (CAMBIO DE DECISIÓN respecto del ADR original):
  1. Verifica que el repo exista.
  2. git status --porcelain: si hay cambios pendientes, se detiene y los lista.
  3. Si la rama ya existe, informa y continúa.
  4. Hace pull de la rama base sin importar la rama actual: git pull --ff-only origin <base> si está en ella, o git fetch origin <base>:<base> si está en otra.
  5. Crea la rama con git switch -c <rama> <base>.
  6. Si el pull falla, error bloqueante (nunca crear la rama desde una base vieja).
  7. Nunca commit, add ni push.
  8. Override puntual con --base.
- Tipos de issue: Epic/Épica bloqueadas (aviso, sin rama ni documento). Bug/Error/Defecto → plantilla bug, prefijo bugs. Story/Historia/Task/Tarea/Subtarea/Sub-task y el resto → plantilla historia, prefijo features. La "estructura idéntica" del documento pasa a ser idéntica POR TIPO.
- Ollama:
  - Modelo mínimo qwen2.5:3b (el 1.5b queda descartado por calidad). ollama_timeout_seconds por defecto 120 (medido: 30–105 s por ticket solo con CPU), streaming para mostrar progreso, keep_alive corto.
  - Salida estructurada pasando el JSON Schema del tipo en `format`. El JSON Schema es la fuente de verdad (validado con Ajv), no Zod.
  - El primer campo del schema es `presenteEnTicket`, seguido de un posprocesado determinista en código (ver templates/README.md en rama-prueba).
- Prompts y plantillas: archivos versionados en finalproject-ANR/templates/. Se registra prompt_version en ticket_logs.
- Modelo de datos:
  - app_config: + jira_email, + tickets_root_path, + branch_user_suffix; prefijos por defecto features/bugs; ollama_model qwen2.5:3b; ollama_timeout_seconds 120.
  - projects_config se reemplaza por jira_projects + repositories.
  - ticket_logs: una fila por (ticket_id, repository_id) con upsert; + repository_id nullable, issue_type, base_branch, branch_status ('created','already_existed','pending_changes','error'), ollama_status incluye 'reused', prompt_version.
  - DDL completo en la §8.4 del registro.
- Stack (ADR-006.1 pasa de Propuesto a ACEPTADO): Node.js ≥ 22.13 + TypeScript strict, node:sqlite (sin compilación nativa), Commander + @inquirer/prompts + un spinner simple, SIN Ink (Ink e inquirer compiten por stdin), Handlebars, Ajv, Vitest, msw.
- El código vive en finalproject-ANR/ (no en devflow-cli/ como dice el árbol actual de 002 §2.3).

ARCHIVOS A ACTUALIZAR
- docs/PRD.md
- docs/ADR-001-arquitectura-inicial.md: actualizar ADR-003.1 y agregar un ADR nuevo para el cambio de alcance del Git Manager, registrado como cambio de decisión con su motivo, sin reescribir la decisión original.
- docs/008-evaluacion-stack-tecnologico.md (estado Aceptado + medición inicial de Ollama)
- docs/001, docs/002 (prosa + diagramas Mermaid de componentes y de secuencia), docs/003 (DDL + ERD Mermaid), docs/005 (US-01 a US-03), docs/006 (TK-01 a TK-03)
- README.md (solo los resúmenes; enlaza a docs/)
- CLAUDE.md: reemplaza el bullet del Git Manager y agrega una sección "Reglas de implementación" con estas restricciones técnicas en forma de lista corta, para que las lean todas las sesiones siguientes.

REGLAS
- Docs en español. Nombres de archivo sin acentos.
- NO cambies la estructura de secciones existente: solo el contenido. Si algo exige reestructurar, pregúntame primero.
- Los diagramas Mermaid se actualizan junto con la prosa.
- No crees código ni la carpeta finalproject-ANR/ todavía.

Al terminar, dame la lista de archivos modificados y ejecuta:
  grep -rn "ID-resumen\|multi-repo\|projects_config\|DEFAULT 15\|devflow-cli/" docs README.md CLAUDE.md
Cada resultado tiene que ser una mención histórica (p. ej. en la sección "Antes" del ADR nuevo), nunca una decisión vigente.
```

**✅ Checkpoint:**
1. El `grep` del final solo muestra menciones históricas.
2. Abrir `docs/002` y `docs/003` con la vista previa de Markdown de VS Code y confirmar que los diagramas Mermaid se renderizan.
3. Revisar `git diff --stat`: no debería haber archivos fuera de `docs/`, `README.md` y `CLAUDE.md`.
4. Commit: `docs: decisiones de validación pre-código`.

---

## Paso 2 — Andamiaje del proyecto

```text
Crea el andamiaje de DevFlow CLI en finalproject-ANR/ siguiendo las "Reglas de implementación" de CLAUDE.md y el árbol de docs/002 §2.3. Todavía SIN lógica de negocio.

- package.json:
  - "type": "module", "engines": { "node": ">=22.13" }, "bin": { "devflow": "dist/tui/cli.js" }.
  - Scripts: build (tsc), dev (tsx src/tui/cli.ts), typecheck (tsc --noEmit), lint (eslint), test (vitest run), test:watch, coverage, doctor (se completa en el Paso 3), eval:prompts (se completa en el Paso 7).
- Dependencias: commander, @inquirer/prompts, un spinner liviano (p. ej. yocto-spinner u ora), handlebars, ajv.
  Desarrollo: typescript, tsx, vitest, @vitest/coverage-v8, msw, eslint + typescript-eslint, @types/node.
  NO instalar ink, better-sqlite3 ni nada que compile código nativo.
- tsconfig con strict, noUncheckedIndexedAccess, module/moduleResolution NodeNext, outDir dist.
- ESLint con una regla de capas que falle el lint si:
  (a) algo fuera de src/database/ importa node:sqlite;
  (b) src/tui/ importa algo de src/services/ que no sea el orquestador, o algo de src/database/;
  (c) src/services/ importa de src/tui/.
  Usa no-restricted-imports por carpeta (overrides) en vez de agregar plugins pesados.
- Al arrancar, src/tui/cli.ts comprueba la versión de Node y, si es menor que 22.13, termina con un mensaje accionable.
- Carpetas vacías con .gitkeep: src/{tui,services,database,shared}, templates/, tests/{unit,integration,fixtures}.
- .gitignore: node_modules, dist, coverage, .eval-out/.
- Un test trivial en tests/unit/smoke.test.ts para que vitest tenga algo que ejecutar.
- Un test de lint "negativo": un archivo temporal que importe node:sqlite desde src/services, verificar que el lint falla y borrarlo. Muéstrame esa salida.
- Reemplaza la sección "Build / test commands" de CLAUDE.md con los comandos reales.
```

**✅ Checkpoint:**
```bash
cd finalproject-ANR && npm install && npm run typecheck && npm run lint && npm test && npm run build && node dist/tui/cli.js --help
```
Todo tiene que pasar sin errores, `--help` tiene que mostrar el nombre `devflow` y el `npm install` no debe disparar `node-gyp`.

---

## Paso 3 — Validación del entorno (`doctor`)

```text
Antes de escribir los servicios, crea finalproject-ANR/scripts/doctor.ts (script npm "doctor") que valide el entorno real. Es lo que hicimos a mano con curl en la validación pre-código, ahora automatizado y reutilizable.

Comprobaciones. Cada una imprime ✅/❌ con un mensaje accionable, y el script termina con código 1 si alguna crítica falla:
1. Node ≥ 22.13 y que node:sqlite se pueda importar.
2. git en el PATH, versión ≥ 2.23 (necesaria para git switch).
3. Jira, leyendo credenciales SOLO de un archivo de desarrollo: ~/.config/devflow/jira.env (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN) o la ruta de la variable DEVFLOW_JIRA_ENV.
   - GET /rest/api/2/myself → muestra solo el displayName.
   - Si se pasa --project <KEY>: GET /rest/api/2/project/<KEY>; ante un 404, desambigua con /myself.
   - JAMÁS imprimas el token ni lo escribas en logs.
4. Ollama: GET {host}/api/version y GET {host}/api/tags. Verifica que el modelo configurado (por defecto qwen2.5:3b) esté descargado; si falta, sugiere `ollama pull qwen2.5:3b`.
5. Si se pasa --ollama-smoke: un /api/generate mínimo con format = {schema trivial}, mostrando la duración y si el JSON vino válido.

El script NO usa SQLite ni la configuración de la app: es una herramienta de desarrollo y diagnóstico. Que quede comentado en su cabecera.
```

**✅ Checkpoint:**
```bash
npm run doctor -- --project SCRUM --ollama-smoke
```
Tiene que dar todo ✅, mostrar "Andrea Rocha" y "SCRUM — Mi Team", y un smoke de Ollama con JSON válido. Probar también un caso de error: con un token falso en una copia del `.env` (`DEVFLOW_JIRA_ENV=/ruta/copia npm run doctor`), tiene que decir "token inválido", no "no existe".

---

## Paso 4 — Contratos compartidos y configuración de rutas

```text
Implementa la capa src/shared/ según docs/002 §2.2 y docs/006, sin servicios todavía.

- src/shared/errors/result.types.ts: StepResult<T> como unión discriminada por `kind`: Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante.
  - Subtipos de ErrorBloqueante: RepositorioNoEncontrado, CambiosPendientes (con la lista de archivos), NoSePudoActualizarBase, PermisosInsuficientes, ClaveNoConfigurada, TipoBloqueado, ErrorInesperado.
  - Motivos de FallbackManual: network_timeout, invalid_token, not_found, rate_limited.
  - Incluye un helper assertNever para obligar a tratar todos los casos de un switch.
- src/shared/types/: ContextoTicket (ticketId, title, description, issueType, source: 'jira' | 'manual'), AppConfig, JiraProject, Repository, TicketLogEntry, TicketRunSummary (un solo repo y una sola rama por ejecución), todos alineados al DDL de docs/003.
- src/shared/config/paths.ts: resuelve la base de datos en %APPDATA%\DevFlowCLI\devflow.db y la carpeta de tickets en %USERPROFILE%\DevFlowCLI\tickets.
  - Usa process.env.APPDATA y os.homedir(). En WSL/Linux, para desarrollo: ~/.config/DevFlowCLI y ~/DevFlowCLI/tickets.
  - La variable DEVFLOW_HOME sobrescribe ambas rutas (para los tests).
- src/shared/naming.ts (funciones puras):
  - buildBranchName(prefijo, ticketId, sufijo) → "bugs/SCRUM-2-AROCHA".
  - suggestUserSuffix(displayName) → "Andrea Rocha" → "AROCHA" (sin acentos, mayúsculas, solo A-Z0-9).
  - isValidProjectKey ^[A-Z][A-Z0-9_]+$, isValidTicketId (CLAVE-número), isValidUserSuffix ^[A-Z0-9]+$.
- Tests unitarios de naming y paths, incluidos acentos, ñ, nombres de una sola palabra y DEVFLOW_HOME.
```

**✅ Checkpoint:**
```bash
npm run typecheck && npm test -- tests/unit/shared
```
Además, abrir `result.types.ts` y comprobar que al quitar un caso de un `switch` que use `assertNever` falle `npm run typecheck`. Después restaurarlo.

---

## Paso 5 — Storage Layer (TK-01)

```text
Implementa TK-01 según docs/003 (el DDL actualizado del Paso 1) y docs/006.

- src/database/migrations/0001_initial_schema.sql, con el DDL EXACTO de docs/003: app_config (fila única id=1), jira_projects, repositories, ticket_logs e índices. Un runner de migraciones idempotente con una tabla schema_migrations.
- src/database/sqlite-storage-manager.ts sobre node:sqlite (DatabaseSync). Al abrir: PRAGMA journal_mode=WAL y PRAGMA foreign_keys=ON.
  Métodos:
  - getAppConfig(): AppConfig | null
  - upsertAppConfig(partial)
  - listJiraProjects(), getJiraProjectByKey(key), addJiraProject({key, name}), removeJiraProject(key)
  - listRepositories(projectId), addRepository(...), updateRepository(...), removeRepository(...)
  - upsertTicketLog(entry): por (ticket_id, repository_id). OJO: SQLite no considera iguales dos NULL en un UNIQUE, así que el caso repository_id NULL (clave sin repos) se resuelve con un SELECT previo dentro de una transacción.
  - getTicketLog(ticketId, repositoryId | null).
- src/database/local-file-storage.ts: write(path, content), read(path), exists(path), mkdirp(path). Sin lógica de dominio.
- Tests con ':memory:' y con un archivo temporal (para WAL):
  - Las migraciones aplicadas dos veces no fallan.
  - getAppConfig() devuelve null con la tabla vacía.
  - Una clave duplicada se rechaza.
  - Dos repos con el mismo nombre dentro de una clave se rechazan; en claves distintas se aceptan.
  - El upsert de ticket_logs no duplica filas, ni con repo ni sin repo.
  - Borrar una clave borra sus repositorios en cascada.
- Verifica con el lint que nadie fuera de src/database importe node:sqlite.
```

**✅ Checkpoint:**
```bash
npm test -- tests/unit/database && npm run lint
```
Para el caso con `NULL`, pedir que muestren el test concreto que llama dos veces a `upsertTicketLog` con `repositoryId: null` y verificar que queda una sola fila.

---

## Paso 6 — Jira REST Client

```text
Implementa src/services/jira/jira-rest-client.ts según docs/002 y docs/006. Recibe por constructor { baseUrl, email, apiToken, timeoutSeconds } y un fetch inyectable. Sin SQLite.

Métodos (todos devuelven StepResult):
- fetchTicket(ticketId) → GET /rest/api/2/issue/{id}?fields=summary,description,issuetype,status → ContextoTicket. Un description null pasa a ''. El tipo de issue se devuelve tal cual viene.
- getProject(key) → GET /rest/api/2/project/{key} → { key, name }.
- getMyself() → GET /rest/api/2/myself → { displayName, accountId }.
- searchAssignedOpenTickets(keys[]) → GET /rest/api/2/search/jql con jql = project in (...) AND assignee = currentUser() AND statusCategory != Done AND issuetype != Epic ORDER BY updated DESC, fields=summary,issuetype,status, maxResults=50. Las claves van entre comillas en la JQL.

Reglas de error (lecciones verificadas contra Jira Cloud real):
- Ante un 404 en /issue o /project, llamar a /myself: si da 401 → FallbackManual('invalid_token'); si da 200 → FallbackManual('not_found').
- 401/403 directos → invalid_token.
- 429 → respetar Retry-After (con un máximo de 10 s) y reintentar una vez; si vuelve a fallar → rate_limited.
- Timeout (AbortSignal.timeout) → un reintento tras 2 s; si persiste → network_timeout.
- Ningún error sale como excepción.
- El token nunca aparece en mensajes de error ni en logs.

Tests con msw que cubran cada rama, incluido "404 en /issue + 401 en /myself → invalid_token".

Agrega además scripts/jira-smoke.ts, que use ~/.config/devflow/jira.env y llame a fetchTicket('SCRUM-2'), getProject('SCRUM') y searchAssignedOpenTickets(['SCRUM','TC']).
```

**✅ Checkpoint:**
```bash
npm test -- tests/unit/services/jira && npx tsx scripts/jira-smoke.ts
```
El smoke tiene que mostrar SCRUM-2 como tipo `Error`, "SCRUM — Mi Team" y la lista de tickets asignados (SCRUM-2, SCRUM-1).

---

## Paso 7 — Plantillas, prompts, fixtures y evaluador de prompts

```text
Recupera los recursos ya validados de rama-prueba, en lugar de volver a iterarlos desde cero:
  git checkout rama-prueba -- finalproject-ANR/templates finalproject-ANR/tests/fixtures

Después aplica estas correcciones pendientes que quedaron detectadas en la validación:
1. Plantillas documents/*.md.hbs:
   - Cabecera con un solo repo y una sola rama (variables `repo` y `rama`; "Sin repositorio" / "Sin rama" si están vacías).
   - Comprueba que no se use ningún helper inexistente: la numeración de listas usa "1." en cada ítem (Markdown la autonumera).
   - Se renderiza con Handlebars { noEscape: true }.
2. issue-types.json: confirma tiposBloqueados (Epic, Épica), que Subtarea y Sub-task vayan a historia, y promptVersion bug-v3 / historia-v2.
3. Agrega en issue-types.json, para bug, la regla "esperadoAusente": si presenteEnTicket.esperado es false, el `then` de cada escenario se reemplaza por "_Completar: comportamiento esperado (no especificado en el ticket)_". Así se evita que el Then describa el error.
4. Agrega en issue-types.json, para bug, "pistasEntorno": ["entorno", "ambiente", "versión", "version", "environment"]. Si la descripción contiene alguna y el modelo marcó entorno = false, NO se sobrescribe el campo y se agrega la pregunta "Verificar el entorno indicado en el ticket". Esto compensa que el modelo de 3B no sea estable en esa clasificación.
5. Actualiza templates/README.md con estas dos reglas nuevas.

Crea scripts/eval-prompts.ts (script npm "eval:prompts"):
- Recorre los fixtures de tests/fixtures/tickets/, o uno solo con --fixture <nombre>.
- Por cada uno: mapeo de tipo (o bloqueo si es épica) → prompt → Ollama con format = schema → validación con Ajv → posprocesado → render.
- Escribe los resultados en .eval-out/ (ignorado por git) y muestra una tabla: fixture, plantilla, Ok/Fallback, segundos, tokens, flags de presenteEnTicket y ajustes aplicados.
- El posprocesado tiene que IMPORTAR la misma función que usará el OllamaAITransformer (src/services/ollama/postprocess.ts, que creas ahora como función pura, con tests unitarios). Nada de copias.

Ollama NO se usa en la suite normal de tests: eval:prompts es un script aparte, porque tarda 30–100 s por ticket.
```

**✅ Checkpoint:**
```bash
npm test -- tests/unit/services/ollama/postprocess && npm run eval:prompts -- --fixture bug-real-scrum2 && npm run eval:prompts -- --fixture epica
```
Revisar a ojo `.eval-out/bug-real-scrum2.md` contra `tests/fixtures/ejemplos-salida/bug-real-scrum2.md`. La épica tiene que mostrar el mensaje de bloqueo sin llamar a Ollama.

---

## Paso 8 — Ollama AI Transformer

```text
Implementa src/services/ollama/ollama-ai-transformer.ts según docs/002 (ADR-003.1 actualizado). Recibe por constructor { host, model, timeoutSeconds, templatesDir } y un fetch inyectable.

processContext(ctx: ContextoTicket, onProgress?: (tokensGenerados: number) => void): Promise<StepResult<DocumentoFase1>>
1. Resuelve la plantilla con issue-types.json. Si el tipo está bloqueado, devuelve ErrorBloqueante('TipoBloqueado') con el mensaje ya renderizado. El orquestador también lo comprueba antes; esto es defensa en profundidad.
2. Arma el system prompt (concatenando los archivos de systemPrompt) y el prompt de usuario (ticket.user.md con Handlebars).
3. POST /api/generate con { model, system, prompt, format: <schema>, stream: true, keep_alive: '30s', options: { temperature: 0.1 } }. Lee el stream NDJSON, acumula `response` y llama a onProgress por cada chunk. Timeout total de timeoutSeconds (por defecto 120) con AbortSignal.
4. Parsea el JSON y valídalo con Ajv contra el mismo schema. Ollama no garantiza minItems/maxItems, así que la validación posterior es obligatoria.
5. Rechaza la respuesta si contiene un bloque de código.
6. Aplica postprocess() (Paso 7) y devuelve Ok({ tipoPlantilla, promptVersion, modelo, fase1 }).
7. Cualquier fallo (conexión rechazada, modelo ausente, timeout, JSON inválido, schema, código) → FallbackDeterminista con un motivo legible y la descripción original. Nunca una excepción.

Tests con msw que simulen un stream NDJSON válido, un JSON que no cumple el schema, una respuesta con un bloque de código, un timeout, ECONNREFUSED y un 404 de modelo inexistente. Comprueba que onProgress se llama.
```

**✅ Checkpoint:**
```bash
npm test -- tests/unit/services/ollama
```
Después, con Ollama apagado (`ollama stop qwen2.5:3b` y parar el servicio), `npm run eval:prompts -- --fixture bug-escueto` tiene que terminar en **Fallback** con el motivo legible, sin colgarse. Si `eval:prompts` todavía no usa el transformer, pedir que lo cambie a hacerlo en este paso.

---

## Paso 9 — Git Manager

```text
Implementa src/services/git/git-manager.ts según el ADR nuevo del Git Manager (docs/ADR-001) y docs/002. Recibe un runner de comandos inyectable (execFile de git con cwd y timeout) para poder espiarlo en los tests.

createBranch({ repoLocalPath, branchName, baseBranch }): Promise<StepResult<{ branchName, baseBranch, status: 'created' | 'already_existed' }>>
Orden estricto:
1. Comprueba que repoLocalPath exista y que `git rev-parse --is-inside-work-tree` dé true → si no, ErrorBloqueante('RepositorioNoEncontrado').
2. `git status --porcelain`. Si hay salida → ErrorBloqueante('CambiosPendientes', archivos), SIN tocar nada más.
3. `git rev-parse --verify --quiet refs/heads/<branchName>`. Si existe → Ok({ status: 'already_existed' }), sin pull ni switch.
4. Rama actual (`git branch --show-current`). Si es baseBranch → `git pull --ff-only origin <base>`; si no → `git fetch origin <base>:<base>`. Si falla → ErrorBloqueante('NoSePudoActualizarBase') con stderr resumido.
5. `git switch -c <branchName> <base>`.
Está PROHIBIDO ejecutar commit, add, push, stash, reset o checkout de archivos en cualquier camino. Verifícalo con un test que espíe el runner en todos los caminos.

Tests:
- Unitarios con el runner simulado, uno por cada camino.
- De integración en tests/integration/git-manager.test.ts con git real: crea en un directorio temporal un repo "remoto" bare, un clon y un segundo clon que empuja un commit nuevo a main. Verifica que createBranch, estando el primer clon en OTRA rama, crea la rama desde el main actualizado (contiene el commit nuevo). Cubre también cambios pendientes, la rama ya existente y un remoto inaccesible.
```

**✅ Checkpoint:**
```bash
npm test -- tests/unit/services/git tests/integration/git-manager
```
Prueba manual en un repo de juguete. Dejar un archivo modificado, ejecutar el smoke y comprobar que se detiene y lista el archivo. Después, sin cambios y parado en otra rama, comprobar que la rama nueva sale del `main` actualizado:
```bash
git log --oneline -1 <rama nueva>
git log --oneline -1 origin/main
```
Las dos líneas tienen que mostrar el mismo commit.

---

## Paso 10 — FileSystem Manager y renderizado del documento

```text
Implementa src/services/filesystem/filesystem-manager.ts según ADR-004.1 y docs/002. Usa LocalFileStorage (Paso 5) para la entrada/salida; este componente decide QUÉ se escribe y DÓNDE. Nunca escribe dentro del repositorio Git del proyecto.

Estructura, con ticketsRoot inyectado:
- Con repositorio: <ticketsRoot>/<ID>/<repo>/<ID>-<repo>.md + <ticketsRoot>/<ID>/<repo>/adjuntos/
- Sin repositorio: <ticketsRoot>/<ID>/<ID>.md + <ticketsRoot>/<ID>/adjuntos/
- Fase 1 cacheada en <ticketsRoot>/<ID>/.devflow/fase1.json, compartida entre repositorios.

Métodos:
- getCachedFase1(ticketId) / saveFase1(ticketId, fase1). No guardes en caché los resultados de fallback.
- writeDocument({ ticketId, repo, rama, ctx, resultadoFase1, ... }):
  - Si el documento no existe, renderiza la plantilla del tipo completa.
  - Si existe, regenera SOLO el bloque entre <!-- DEVFLOW:FASE1:INICIO --> y <!-- DEVFLOW:FASE1:FIN --> y preserva todo lo demás byte a byte.
  - Si faltan los marcadores, no sobrescribe: devuelve ErrorBloqueante con el aviso.

Tests:
- Escribir un documento nuevo, con y sin repo.
- Reescribir después de editar a mano la Fase 2: la Fase 2 se conserva intacta.
- Marcadores borrados → no se sobrescribe.
- Rutas con espacios y con acentos.
- La caché de Fase 1 la reutiliza el segundo repo.
- Un test que verifique que ninguna ruta escrita cae dentro de repoLocalPath.
```

**✅ Checkpoint:**
```bash
npm test -- tests/unit/services/filesystem
```
Abrir a mano el documento que generan los tests (pedir que dejen uno en `.eval-out/fs-sample/`), editar la Fase 2, volver a ejecutar el test de regeneración y comparar con `diff`: solo debe cambiar el bloque de la Fase 1.

---

## Paso 11 — Orquestador (TK-02)

```text
Implementa src/services/orchestrator/ticket-orchestrator.ts según docs/002 (diagrama de secuencia actualizado) y docs/006. Es el ÚNICO componente que habla con SQLiteStorageManager y el único que escribe ticket_logs. Lee la configuración una sola vez y la inyecta por constructor en Jira, Ollama, Git y FileSystem.

API, pensada para la TUI:
- listAssignedTickets(): tickets abiertos asignados en las claves configuradas.
- resolveTicket(ticketId):
  1. Valida el formato.
  2. Comprueba que el prefijo sea una clave dada de alta; si no, ErrorBloqueante('ClaveNoConfigurada') con la lista de claves disponibles, SIN llamar a Jira.
  3. Llama a fetchTicket. Si falla, FallbackManual y se permite contexto manual.
  4. Si el tipo está bloqueado (épica) → TipoBloqueado.
  5. Devuelve el contexto y los repositorios de la clave.
- startTicket({ ctx, repositoryId | null, baseOverride?, regenerarFase1? }, onStep), con onStep(paso: 'jira' | 'git' | 'ollama' | 'filesystem', estado: 'started' | 'progress' | 'ok' | 'fallback' | 'error', detalle?):
  1. Git:
     - Sin repo → se omite.
     - Con repo → createBranch con buildBranchName(prefijo según el tipo, ID, sufijo) y la base (override o default_base_branch).
     - Si da ErrorBloqueante, se detiene ahí (no se crea el documento) y se registra el log con branch_status.
  2. Fase 1:
     - Si hay caché y no se pidió regenerar, se reutiliza (ollama_status 'reused').
     - Si no, processContext con onProgress → onStep('ollama', 'progress').
     - Si da Ok, se guarda en caché.
  3. FileSystem → writeDocument.
  4. upsertTicketLog con el resultado agregado y prompt_version.
  Devuelve un TicketRunSummary.
- Métodos de configuración para la TUI: getMyselfSuggestion(), y alta/baja de claves (validadas con getProject, desambiguando el 404) y de repositorios (verificando que la ruta sea un repo git con remoto origin y que la rama base exista en el remoto con `git ls-remote --heads origin <base>`).

Test de integración tests/integration/ticket-flow.test.ts, con Jira y Ollama simulados (msw), git real en un directorio temporal y SQLite en memoria:
- Camino feliz con repo.
- Segundo repo del mismo ticket reutilizando la Fase 1.
- Clave sin repos (solo documento).
- Épica bloqueada.
- Clave no configurada (sin llamada a Jira).
- Ollama caído (documento con ⚠️).
- Cambios pendientes (sin documento, log con pending_changes).
- Reejecución que no duplica el log.
```

**✅ Checkpoint:**
```bash
npm test && npm run lint && npm run typecheck
```
Toda la suite en verde. Revisar también que el test "clave no configurada" verifique explícitamente cero llamadas a Jira (msw sin peticiones).

---

## Paso 12 — TUI (TK-03)

```text
Implementa la TUI según docs/002 y docs/006 (TK-03), sin Ink: Commander para los comandos, @inquirer/prompts para la interacción y un spinner simple. La TUI SOLO habla con el orquestador (el lint ya lo impone).

Comandos:
- devflow config: asistente inicial y edición.
  1. URL de Jira, email y token (el token con input oculto, nunca se reimprime). Validar con /myself antes de guardar.
  2. Sufijo de usuario, precargado con la sugerencia del displayName y editable.
  3. Ollama: host y modelo (por defecto qwen2.5:3b) y timeout (por defecto 120).
  4. Carpeta de tickets.
- devflow config proyectos: menú para agregar, listar, editar y quitar claves y sus repositorios ("¿Agregar otro repositorio?" / "¿Agregar otra clave?").
- devflow start [ID] [--base <rama>] [--regenerar]:
  - Sin ID → select con los tickets asignados ("SCRUM-2 · Error · El botón Aceptar…").
  - Con repos → select de UN repositorio (si hay uno solo, viene preseleccionado).
  - Ante FallbackManual de Jira → avisar del motivo y pedir título y descripción a mano.
  - Progreso por paso con spinner; durante Ollama, el texto se actualiza con los tokens generados (es lo que evita que parezca colgado durante 30–100 s).
  - Resumen final con repositorio, rama, rama base y ruta del documento, y el aviso "⚠️ Generado sin Ollama" si corresponde.
  - Mensajes distintos para cada ErrorBloqueante (cambios pendientes con la lista de archivos, clave no configurada con las claves disponibles, épica, base no actualizable).
  - Recordatorio final: "Para otro repositorio de este ticket, vuelve a ejecutar devflow start <ID>".

Si no existe configuración, cualquier comando que no sea config pide ejecutar `devflow config` primero.

Tests unitarios de la TUI con el orquestador simulado: validación del ID, fallback manual, épica, cambios pendientes y el resumen con fallback.
Documenta en README §1.4 que en Git Bash standalone (mintty) los prompts necesitan winpty, o usar Windows Terminal.
```

**✅ Checkpoint (manual, en WSL):**
```bash
npm run build
DEVFLOW_HOME=/tmp/devflow-prueba node dist/tui/cli.js config
DEVFLOW_HOME=/tmp/devflow-prueba node dist/tui/cli.js config proyectos
DEVFLOW_HOME=/tmp/devflow-prueba node dist/tui/cli.js start
```
1. En `config`, cargar las credenciales reales y aceptar la sugerencia `AROCHA`.
2. En `config proyectos`, dar de alta `SCRUM` con un repo de juguete como `backend`.
3. En `start`, elegir SCRUM-2 en la lista y el repo `backend`.
4. Tiene que verse avanzar el spinner con los tokens. Al terminar, verificar:
   - En el repo de juguete, `git branch --show-current` da `bugs/SCRUM-2-AROCHA`.
   - Existe `/tmp/devflow-prueba/.../SCRUM-2/backend/SCRUM-2-backend.md`.
5. Probar también `start SCRUM-2` con un archivo modificado en el repo de juguete: tiene que detenerse y listarlo.

---

## Paso 13 — Validación E2E en Windows, medición y documentación final

```text
Cierre de la Entrega 2. No agregues funcionalidades nuevas: solo validación, correcciones de lo que falle y documentación.

1. Crea docs/guia-validacion-windows.md con los pasos para probar en Windows 10/11 con Windows Terminal (PowerShell y Git Bash dentro de Windows Terminal):
   - Instalación con npm.
   - devflow config y devflow config proyectos.
   - devflow start sobre un repo real con backend y frontend (dos ejecuciones seguidas).
   - Comprobar que la segunda reutiliza la Fase 1.
   - Comprobar que los archivos quedan en %USERPROFILE%\DevFlowCLI\tickets y la base de datos en %APPDATA%\DevFlowCLI.
2. Agrega scripts/medir.ts, que ejecute el flujo completo y registre el RSS pico del CLI, la memoria de Ollama (`ollama ps`), el tiempo de arranque y la duración de cada paso. Es la condición 4 de ADR-006.1: correrlo en un puesto de 8 GB con los IDEs abiertos.
3. Con los resultados que te pase, actualiza docs/008 (cierre de la medición) y, si el CLI supera 100 MB o Ollama tarda más que el timeout, propón un ajuste antes de cambiar nada.
4. Completa en el README: §1.3 (capturas, que te paso yo), §1.4 (instalación real), §2.4 (infraestructura y distribución), §2.6 (tests: unitarios, de integración con git real, evaluación de prompts) y §7 (PR 2 y PR 3, detallados en docs/007).
5. Registra los prompts de esta fase en prompts.md (resumen) y en docs/prompts-claude-fase-implementacion.md (literales), igual que en la fase inicial.

Reglas de documentación: español, sin cambiar la estructura de secciones, README resumido con enlaces a docs/.
```

**✅ Checkpoint:**
1. La guía de Windows ejecutada de punta a punta en una máquina Windows real, con las dos ejecuciones (backend y frontend) correctas.
2. `scripts/medir.ts` ejecutado en un puesto de 8 GB y sus números volcados en `docs/008`.
3. `npm test && npm run lint && npm run typecheck` en verde.
4. Que `grep -rn "> " README.md` ya no muestre instrucciones del curso sin responder en las secciones 1–7.
5. Abrir los PRs hacia `main` y documentarlos en `docs/007`.
