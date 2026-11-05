# Change: TK-03a — CLI base y comando `devflow config`

- **Estado:** Implementado
- **Fuente:** `docs/006-tickets-de-trabajo.md` (TK-03a)
- **Depende de:** TK-02g (hecho y fusionado), TK-01. Usa el contrato `StepResult` de TK-02a.
- **INVEST:** Observaciones: S. Un solo criterio técnico (CA9) pero con tres frentes (arranque y composición, configuración de Jira y sufijo, gestión de claves y repositorios) y varias decisiones abiertas; cabe en 3 escenarios y 4 tareas. Si crece al implementar, separar `devflow config proyectos` de `devflow config`.

## Propósito

Primer punto de entrada ejecutable de DevFlow CLI: `cli.ts` (Commander) con `devflow config` y `devflow config proyectos`, que usan solo al Orquestador (TK-02g) para dejar la herramienta configurada: credenciales de Jira, sufijo de usuario, claves de proyecto y repositorios con su rama base. Cierra el Hito 1: la primera demo ejecutable.

## Criterios de aceptación de origen

- CA1 (CA9 del TK-03 original, primera mitad): `devflow config proyectos` permite agregar una clave (validada por el Orquestador), asociarle repositorios con su rama base y quitar claves o repositorios.
- CA2 (CA9 del TK-03 original, segunda mitad): `devflow config` propone el sufijo de usuario sugerido desde Jira, que el usuario confirma o edita.
- DoD-a: la TUI no importa clientes de Jira/Git/Ollama ni el storage manager; solo invoca al Orquestador (verificable por revisión de imports).
- DoD-b: los nombres `devflow config` y `devflow config proyectos` están decididos (H-06); los flags y subcomandos concretos se fijan al refinar este ticket y se validan antes de cerrarlo. *(Ver decisión 1.)*
- DoD-c: revisión de código aprobada y mergeada (se tilda tras la merge; no es un escenario).

Criterios de la historia relacionada (US-01) que este ticket cubre en la TUI: CA1 (alta de clave con confirmación), CA2 (rechazo con motivo, distinguiendo token inválido), CA3 (repositorio con nombre, ruta y rama base; el rechazo de Git se explica), CA4 (sufijo propuesto, confirmado o editado) y CA5 (actualizar sin duplicar). US-01 CA6 (aviso al iniciar un ticket sin claves) queda **fuera de este cambio**: pertenece a `devflow start` (TK-03b / Hito 3).

## Escenarios BDD

### E1 — Arranque del CLI y composición del Orquestador (cubre: CA1, CA2 en el arranque, DoD-a)

- **Given** un archivo de base de datos temporal, un `buildProgram` con un Orquestador y unos prompts simulados, y la configuración de lint de capas
- **When** se ejecuta `createOrchestrator` con la ruta de la base, se arma el programa con Commander y se invocan `devflow --help`, `devflow config`, `devflow config proyectos` y un comando desconocido
- **Then** `createOrchestrator` migra la base y devuelve un Orquestador funcional (`getConfig()` es `null` y `listProjects()` vacío en una base nueva); el programa registra exactamente `config` (con el subcomando `proyectos`) y la ayuda lista ambos; cada comando invoca su manejador una sola vez; un comando desconocido falla con el mensaje de Commander y código de salida distinto de cero; y `npm run lint` pasa sin que `src/tui/` importe `database/`, `services/jira|git|filesystem|ollama/` ni `sqlite-storage-manager`

### E2 — `devflow config`: credenciales de Jira y sufijo de usuario (cubre: CA2, US-01 CA4)

- **Given** un Orquestador simulado sin configuración (primer arranque) y otro con la configuración ya guardada, y unos prompts simulados que devuelven las respuestas del usuario
- **When** se ejecuta `devflow config` con URL, email, token y carpeta de tickets válidos y el usuario acepta el sufijo propuesto, lo edita (`PGOMEZ`), lo edita con un valor inválido, y cuando Jira falla (token inválido, sin respuesta) o la URL no es válida; y se vuelve a ejecutar con configuración existente dejando el token en blanco
- **Then** pide los datos en orden (el token enmascarado, sin mostrarse en pantalla ni en los mensajes), propone el sufijo que devuelve el Orquestador usando esas credenciales y guarda todo en una sola llamada a `saveConfig`; un sufijo editado inválido se vuelve a pedir; si Jira no puede sugerir el sufijo (token inválido o sin respuesta), muestra el motivo en español y deja escribirlo a mano en lugar de abortar; una URL que no es `http(s)://` simple se rechaza con un mensaje antes de guardar; con configuración existente muestra los valores actuales como predeterminados y un token en blanco conserva el guardado; al terminar confirma que la configuración quedó lista

### E3 — `devflow config proyectos`: claves y repositorios (cubre: CA1, US-01 CA1-3 y CA5)

- **Given** un Orquestador simulado con un proyecto, un repositorio con historial y otro sin él, y unos prompts simulados que eligen cada acción del menú
- **When** se elige listar, agregar clave (válida, inexistente, con token inválido, con Jira sin respuesta), agregar repositorio (nombre, ruta, rama base por defecto `main`; aceptado, rechazado por Git, con una clave sin configurar), editar repositorio, y quitar clave y repositorio (con y sin historial, con y sin confirmación), y salir
- **Then** el menú se repite hasta elegir salir; el listado muestra cada clave con su nombre y sus repositorios con ruta y rama base; el alta de clave confirma que quedó lista y los fallos se traducen a mensajes distintos (clave inexistente, **token inválido sin decir que la clave no existe**, Jira sin respuesta); el alta de repositorio ofrece las claves ya dadas de alta, propone `main` y, si Git lo rechaza, muestra el motivo y permite corregir sin perder lo escrito; editar reemplaza los datos sin duplicar; quitar pide confirmación y, si no se confirma, no invoca al Orquestador; el error por historial del Orquestador se muestra tal cual (mensaje claro, sin traza) y el menú continúa; ningún fallo termina el proceso con una excepción cruda

## Trazabilidad

| Escenario | Criterios cubiertos | Test | Estado |
|---|---|---|---|
| E1 | CA1, CA2 (arranque), DoD-a | `tests/unit/services/orchestrator/create-orchestrator.test.ts` › «E1 — createOrchestrator» (3 casos: base nueva, reapertura, cliente de Jira con la configuración guardada); `tests/unit/tui/cli.test.ts` › «E1 — buildProgram» (7 casos: comandos registrados, ayuda, versión, cada manejador una vez, comando desconocido, manejador que lanza); DoD-a: `tests/unit/lint-rules.test.ts` (reglas de capas de `src/tui/`, ya existentes) y `npm run lint` | Hecho |
| E2 | CA2, US-01 CA4 | `tests/unit/tui/config.command.test.ts` › «E2 — devflow config» (10 casos: primer arranque, sufijo editado, token enmascarado, validaciones, 3 fallos de Jira, configuración existente, token rotado, `saveConfig` que lanza); `tests/unit/tui/failure-message.test.ts` (5); `tests/unit/shared/jira-base-url.test.ts` (17: URL normalizada o rechazada y carpeta por defecto); `tests/unit/services/orchestrator/ticket-orchestrator.config.test.ts` (11 casos nuevos: URL de Jira en `saveConfig` y `suggestBranchSuffix` con credenciales) | Hecho |
| E3 | CA1, US-01 CA1-3 y CA5 | `tests/unit/tui/config-proyectos.command.test.ts` › «E3 — devflow config proyectos» (22 casos: menú y listado, alta de clave con 3 fallos distintos, alta de repositorio con corrección tras el rechazo de Git, edición, bajas con y sin confirmación, mensaje del historial); `tests/unit/tui/cli.test.ts` › «E1 — Ctrl+C» y «E1 — createHandlers» (4 casos: Ctrl+C silencioso con código 130, Orquestador perezoso y flujos reales); `tests/unit/services/orchestrator/ticket-orchestrator.config.test.ts` (3 casos nuevos de `listRepositories`) | Hecho |

DoD-b (nombres y subcomandos validados) se cierra al aprobar este contrato; DoD-c (revisión mergeada) no es un escenario: se tilda tras la merge. US-01 CA6 queda fuera (ver «Criterios de aceptación de origen»).

## Prerrequisitos

- **No están en `package.json`** y necesitan tu autorización (`/04-tdd-pair` no toca `package.json` sin ella): dependencias de producción `commander` y `@inquirer/prompts`; dependencia de desarrollo `tsx` y un script `start` (ver decisión 2). No se añade un spinner: este ticket no tiene pasos largos (el progreso es de TK-03b).
- Verificado: `SQLiteStorageManager`, `JiraRestClient`, `GitManager`, `TicketOrchestrator` (TK-02g), `resolveDatabasePath` y `AppConfigProvider` existen en `src/`. `src/tui/` **no existe** todavía. La regla de lint de capas para `src/tui/**` ya existe en `eslint.config.js`.
- Node: la máquina local es Node 24; el proyecto exige ≥ 22.13. `tsconfig.json` tiene `noEmit` y no hay script de compilación, y los imports usan la extensión `.js`, así que `node src/tui/cli.ts` no resuelve los módulos (de ahí `tsx`).

## Archivos afectados

| Ruta | Acción |
|---|---|
| `src/tui/cli.ts` | Crear (propuesta): `buildProgram` (Commander) y arranque que usa `createOrchestrator` |
| `src/tui/commands/config.command.ts` | Crear (propuesta): `devflow config` (E2) |
| `src/tui/commands/config-proyectos.command.ts` | Crear (desvío menor, ver decisiones): `devflow config proyectos` (E3) |
| `tests/unit/tui/config-proyectos.command.test.ts` | Crear (propuesta): E3 |
| `src/tui/failure-message.ts` | Crear (*asumido*, ver decisiones): traducción de resultados fallidos a mensajes |
| `src/shared/config/jira-base-url.ts` | Crear (*asumido*): `normalizeJiraBaseUrl` |
| `src/shared/config/app-config.provider.ts` | Modificar (existente, *asumido*): se exporta `defaultTicketsRoot` |
| `tests/unit/shared/jira-base-url.test.ts` | Crear (propuesta) |
| `tests/unit/tui/failure-message.test.ts` | Crear (propuesta) |
| `src/tui/prompts/project-config.prompt.ts` | Crear (propuesta): adaptador fino sobre `@inquirer/prompts` (inyectable en los tests) |
| `src/services/orchestrator/create-orchestrator.ts` | Crear (propuesta, *asumido*, no está en la lista del ticket): raíz de composición que arma `SQLiteStorageManager`, `GitManager` y la fábrica de `JiraRestClient` |
| `src/services/orchestrator/ticket-orchestrator.ts` | Modificar (existente, *asumido*): `suggestBranchSuffix` acepta credenciales opcionales y `saveConfig` valida `jiraBaseUrl` (decisiones 3 y 4) |
| `tests/unit/tui/cli.test.ts` | Crear (propuesta): E1 |
| `tests/unit/tui/config.command.test.ts` | Crear (propuesta): E2 |
| `tests/unit/tui/config-proyectos.command.test.ts` | Crear (propuesta): E3 |
| `tests/unit/services/orchestrator/create-orchestrator.test.ts` | Crear (propuesta): E1 (composición) |
| `tests/unit/services/orchestrator/ticket-orchestrator.config.test.ts` | Modificar (existente): casos de las decisiones 3 y 4 |
| `package.json` | Modificar con autorización (dependencias y script `start`) |
| `CLAUDE.md` (sección «Build / test commands») | Modificar al cerrar el ticket, con tu autorización: ya existe un punto de entrada |

## Tareas

- [x] 1. RED/GREEN E1: `createOrchestrator` y `buildProgram` con los dos comandos registrados y la ayuda
- [x] 2. RED/GREEN E2: `devflow config` (credenciales, sufijo, errores de Jira) y los cambios del Orquestador de las decisiones 3 y 4
- [x] 3. RED/GREEN E3: `devflow config proyectos` (menú, altas, edición y bajas con los mensajes traducidos)
- [x] 4. Refactor, TSDoc en español de cada export, `npm run typecheck`, `npm run lint` y `npm test`; probar a mano `npm start -- config` contra el Jira de pruebas

## Decisiones y desvíos

*Registro de la implementación (2026-11-05) y puntos aprobados con el contrato:*

- **E1:** el punto de arranque que conecta `createOrchestrator`, `resolveDatabasePath` y los manejadores reales (`main`, solo cuando `cli.ts` se ejecuta directamente) se añade al cerrar E3, cuando existen los manejadores de `config.command.ts`; hasta entonces `cli.ts` solo exporta `buildProgram`. Un manejador que lanza se traduce a mensaje + `exitCode = 1` en `buildProgram`. Se instalaron `commander` ^15, `@inquirer/prompts` ^8 y `tsx` ^4 y el script `start`, con tu autorización.

- **E2, cambios del Orquestador (decisiones 3 y 4):** `suggestBranchSuffix(credentials?)` consulta `/myself` con credenciales aún sin guardar (URL normalizada, timeout guardado o 10 s) y no escribe nada; `saveConfig` valida `jiraBaseUrl` y guarda su `origin`; el mensaje de URL inválida oculta una URL que parezca llevar usuario. `JiraClientFactory` pasó a recibir una `JiraConnection` (credenciales + timeout) en lugar de la `AppConfig` completa; una `AppConfig` sigue siendo válida, así que `createOrchestrator` no cambió.
- *(asumido)* **Archivos no previstos en la tabla, todos pequeños y de `src/`:** `src/shared/config/jira-base-url.ts` (función pura `normalizeJiraBaseUrl`, la usan el Orquestador y el prompt de la URL), `defaultTicketsRoot` exportada desde `app-config.provider.ts` (antes estaba en línea; el constructor la reutiliza y su comportamiento no cambia) y `src/tui/failure-message.ts` (`describeFailure`, traduce los resultados fallidos y la usarán E2 y E3).
- *(asumido)* **Sufijo en una reejecución:** con un sufijo ya guardado se ofrece como valor por defecto y no se vuelve a consultar a Jira. Si Jira no puede sugerirlo en el primer arranque, se muestra el motivo y el usuario lo escribe a mano; no se aborta ni se guarda nada a medias.
- *(asumido)* **Prompts:** `ConfigPrompts` (`input` y `password`) vive en `project-config.prompt.ts`, junto al adaptador `createInquirerPrompts`; E3 añadirá `select` y `confirm`. La validación de cada respuesta va como `validate` del prompt (inquirer vuelve a preguntar), y se prueba la función, no el prompt real.

- **E3, hueco detectado y autorizado por la desarrolladora (2026-11-05):** el Orquestador no podía listar los repositorios de una clave (solo `listRepositoriesForTicket(ticketId)`), y el menú lo necesita para mostrarlos, elegir cuál editar y obtener el `id` que pide `removeRepository`. Se añadió `TicketOrchestrator.listRepositories(jiraProjectKey)`; `listRepositoriesForTicket` la reutiliza. Archivo ya existente de TK-02g, con 3 tests nuevos.
- *(desvío menor)* **Dos archivos de comandos:** `devflow config proyectos` vive en `src/tui/commands/config-proyectos.command.ts` y no en `config.command.ts` (el contrato listaba uno solo), para no mezclar dos comandos de ~120 líneas cada uno. `ConfigPrompts` (E2) no cambió: los prompts del menú son una interfaz aparte, `ProjectPrompts` (`input`, `select`, `confirm`).
- *(asumido)* **Corrección tras un rechazo de Git:** el usuario ve el motivo y se le pregunta si quiere corregir; si acepta, se repiten los prompts con lo escrito como valor por defecto; si no, vuelve al menú. Editar un repositorio no permite cambiar el nombre.
- *(asumido)* **Arranque:** `main` abre la base al ejecutar un comando (no con `--help` ni `--version`) y solo corre cuando `cli.ts` se lanza directamente. Ctrl+C en un prompt termina sin mensaje y con código 130 (decisión 8).
- **Comprobado a mano (sin Jira real):** `npm start -- --version`, `--help`, `config --help`, un comando desconocido (código 1), `config proyectos` sin `APPDATA` (mensaje claro, código 1) y `config proyectos` con una entrada simulada (menú, «Listar», aviso de que no hay claves y salida 130).
- **Observación, fuera de este cambio:** `resolveDatabasePath` (TK-02a) usa `win32.join`; en Linux/WSL, con `APPDATA` definida, la «ruta» sale con barras invertidas y la base se crea como un archivo de nombre raro en el directorio actual. En Windows (la plataforma de destino) es correcta. Pendiente de decidir con la desarrolladora antes de probar a mano en WSL (por ejemplo, una variable `DEVFLOW_DB_PATH` o usar `path.join` fuera de Windows).

- **Tarea 4 (cierre, 2026-11-05):** refactor sin cambio de comportamiento: `required` (validador de «no en blanco») pasó a `src/tui/validators.ts`, antes duplicado en los dos comandos, y el bucle «pedir datos → guardar → corregir si se rechaza» de agregar y editar repositorio quedó en un único helper. Todo export público nuevo lleva TSDoc en español. `typecheck` y `lint` limpios; 429 tests en verde (82 de este ticket); cobertura de `src/services/` en 99,5 % de sentencias (la TUI no entra en el umbral de `vitest.config.ts`, que solo mide `src/services/**`).
- **Desvío aprobado por la desarrolladora (2026-11-05):** la prueba manual de la tarea 4 (`npm start -- config` contra el Jira de pruebas) **no se hace en WSL**; se hará directamente en Windows, la plataforma de destino, junto con la prueba de los demás componentes (Hito 3). Por eso el problema de `resolveDatabasePath` en Linux/WSL (observación de arriba) no se resuelve en este ticket.

- **Prueba contra el Jira real desde WSL (2026-11-05, solo lectura, con un script fuera del repo y una base temporal; el token no se imprimió):**
  - Contra `andreardev.atlassian.net`: `suggestBranchSuffix` con credenciales sin guardar devolvió `AROCHA` y no guardó nada; el alta de `SCRUM`, `MPDD`, `SUP` y `TC` funcionó con sus nombres reales; una clave inexistente dio `not_found` y no se guardó; `listAssignedTickets` devolvió 3 tickets (`SCRUM-3`, `SCRUM-2`, `SCRUM-1`); con un token inválido, tanto el alta como la sugerencia dieron `invalid_token` (no «no existe»); una URL `ftp://` se rechazó sin llamar a Jira y un sitio inexistente dio `network_timeout`.
  - Con Git real (el `origin` de este repositorio): alta correcta con base `main`; base inexistente, ruta que no es repositorio y nombre en blanco rechazados con su motivo; `listRepositoriesForTicket("SCRUM-1")` devolvió el repositorio y `ZZZ-1` las claves disponibles.
  - Con esto, `validateProjectKey`, `getMyDisplayName` y `listAssignedTickets` quedan comprobados también contra Jira real (antes solo con msw). `fetchTicket` sigue sin comprobarse contra Jira real: este ticket no lo usa.
- **Pendiente para la prueba en Windows (Hito 3):** el CLI interactivo con teclado real (menú, token enmascarado, Ctrl+C), la ruta real de la base (`%APPDATA%\DevFlowCLI\devflow.db`) y de la carpeta de tickets, Git con rutas `C:\...` y `npm test` completo (sobre todo `GitManager` y `FileSystemManager`).
- **`CLAUDE.md` (autorizado por la desarrolladora, 2026-11-05):** la sección «Build / test commands» documenta `npm start` y por qué no hay `build`.

- **Revisión de Cursor (2026-11-05), dos hallazgos bajos corregidos:**
  - Los tests de `createOrchestrator` dejaban la base abierta (el Orquestador no tenía `close()`); en Windows un archivo abierto no se puede borrar y el `rmSync` del directorio temporal fallaría. Se añadió `TicketOrchestrator.close()` (idempotente: `node:sqlite` lanza al cerrar dos veces), los tests de composición cierran lo que abren y `main` lo cierra en un `finally`. 2 tests nuevos.
  - Faltaba una coma en el párrafo de estado de `docs/009` («plantillas), TK-02g»); corregido.
  - Verificación: `typecheck` y `lint` limpios; 431 tests en verde (84 de este ticket).

Decisiones aprobadas con el contrato:

1. *(ambiguo, DoD-b)* **Comandos concretos.** Se propone: `devflow config` interactivo (URL de Jira, email, token, carpeta de tickets y sufijo) y `devflow config proyectos` con un menú interactivo (listar, agregar clave, agregar/editar/quitar repositorio, quitar clave, salir). **Sin flags** de configuración no interactiva (YAGNI para el MVP), solo `--help` y `--version` de Commander.
2. *(ambiguo)* **Cómo se ejecuta sin compilar.** Para la demo del Hito 1 se propone `tsx` como dependencia de desarrollo y `"start": "tsx src/tui/cli.ts"`, usable como `npm start -- config`. No se hace `build` a `dist/`: `tsc` no copia `schema.sql` ni las migraciones, y `templates/` se lee con rutas relativas al módulo. El `bin` de `devflow` y el empaquetado quedan para el Hito 3 (junto con la prueba en Windows).
3. *(ambiguo, hueco que deja TK-02g)* **Primer arranque.** `saveConfig` exige el sufijo en el primer alta (`NOT NULL`) y `suggestBranchSuffix` necesita las credenciales ya guardadas. Se propone que `suggestBranchSuffix` acepte opcionalmente `{ jiraBaseUrl, jiraEmail, jiraApiToken }` para consultar `/myself` sin guardar, de modo que `devflow config` pide las credenciales, sugiere, deja confirmar o editar y guarda todo de una vez. Alternativa: guardar primero con un sufijo provisional, que deja la configuración a medias si el usuario cancela.
4. *(ambiguo, heredado de Cursor en la PR #2 y diferido por TK-02g)* **Validación de `jiraBaseUrl`.** Se propone resolverla en el Orquestador (`saveConfig` y las credenciales opcionales de la decisión 3): solo `http:`/`https:`, sin usuario, sin query ni fragmento, y se guarda el `origin`. El endurecimiento del propio `JiraRestClient` (armar las URLs con el `origin`) queda fuera de este cambio.
5. *(asumido)* **Raíz de composición.** `cli.ts` no puede importar `database/`, `jira/` ni `git/` (lint de capas), así que el arranque llama a `createOrchestrator({ databasePath })`, nuevo en `src/services/orchestrator/`. La ruta de la base sale de `resolveDatabasePath()` (`%APPDATA%\DevFlowCLI\devflow.db`).
6. *(asumido)* **Capacidad de prueba de la TUI.** Los comandos reciben sus dependencias (`orchestrator`, `prompts`, `out`) por parámetro y los tests usan dobles; los prompts reales de `@inquirer/prompts` quedan en un adaptador fino que no se prueba aparte. La salida es `console.log`; no hay `views/` ni spinner hasta TK-03b.
7. *(asumido)* **Subtipo `RepositorioNoEncontrado` compartido** (Git vs. repositorio inexistente en `updateRepository`): en este ticket el menú elige el repositorio de una lista, así que el segundo caso no ocurre desde la TUI; la separación en un subtipo nuevo se pospone hasta que algún comando lo necesite.
8. *(asumido)* **Códigos de salida.** Fallo de un comando (error del Orquestador o excepción) → mensaje claro en español y `process.exitCode = 1`; cancelar con Ctrl+C en un prompt termina sin traza.
