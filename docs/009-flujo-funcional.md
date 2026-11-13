# 009. Flujo funcional de DevFlow CLI

> **Documento vivo.** Describe, paso a paso, cómo se comporta DevFlow CLI desde la instalación inicial hasta que el desarrollador completa la documentación de un ticket. Se actualiza a medida que se implementa el código.
>
> Fuentes de verdad: `docs/PRD.md`, `docs/001-descripcion-general-del-producto.md`, `docs/002-arquitectura-del-sistema.md`, `docs/005-historias-de-usuario.md`, `docs/006-tickets-de-trabajo.md`, `docs/ADR-001-arquitectura-inicial.md`. Si este archivo contradice a esas fuentes, gana la fuente; corregir aquí.

**Estado del proyecto:** desarrollo en curso, ticket por ticket. Implementados: TK-00 (scaffold), TK-01 (Storage Layer), TK-02a (base compartida: `StepResult`, configuración, resolutor de tipo de issue, regla de lint), TK-02b (cliente REST de Jira), TK-02c (Git Manager), TK-02d (FileSystem Manager y plantillas), TK-02e (Ollama AI Transformer: prompts, schemas, Ajv y posprocesado), TK-02f (Orquestador: flujo `startTicket` y `ticket_logs`), TK-02h (Fase 1 reutilizable y reprocesable), TK-02g (Orquestador: gestión de configuración, proyectos y repositorios), TK-03a (CLI base, `devflow config` y `devflow config proyectos`), TK-03b1 (`devflow start`: validación del ID, selección de ticket y repositorio y flags) y TK-03b2 (carga manual con tipo de issue y confirmación de acciones; falta el progreso y las pantallas de resultado, TK-03b3). Todo lo demás es comportamiento *especificado*, aún sin código; los pasos que ya tienen parte implementada llevan la etiqueta `🚧 En desarrollo`.

## Cómo mantener este documento

- Cada paso lleva su referencia a historia (`US-XX`) y ticket (`TK-XX`).
- La columna/etiqueta **Estado** de cada paso usa: `📄 Especificado` (solo documentación) · `🚧 En desarrollo` · `✅ Implementado y probado`. Al implementar un paso, cambiar su estado y anotar el commit/PR en el [Registro de cambios](#registro-de-cambios).
- Los **huecos abiertos** (§7) se resuelven actualizando la fuente (US/TK/PRD/ADR) **y** este archivo; luego se marcan como resueltos, no se borran.
- Si una decisión cambia el flujo, actualizar también `README.md` y `docs/001-*.md` / `docs/002-*.md` (ver `CLAUDE.md`).

---

## 0. Resumen del flujo

```text
Etapa 1: Instalación y configuración (devflow config / config proyectos)      US-01 · TK-01 · TK-03a
Etapa 2: Selección y consulta del ticket (devflow start [ID])                  US-02 · TK-02 · TK-03b
Etapa 3: Preparación del entorno (Git + carpetas)                              US-03 · TK-02
Etapa 4: Generación asistida (Ollama → Fase 1 → documento)                     US-03 · TK-02
Etapa 5: Fase 2 manual + registro en SQLite                                    TK-01 · TK-02
```

Contrato de resultado de cada paso orquestado: `Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante`. Ninguna falla de una integración llega a la TUI como excepción cruda.

---

## 1. ⚙️ Instalación y configuración inicial

**Historias:** US-01 · **Tickets:** TK-01 (storage), TK-02 (validaciones), TK-03a (comandos)

### 1.1 Requisitos del entorno — `📄 Especificado`

Ref.: `002` §2.2.1.

- Node.js ≥ 22.13 (la herramienta comprueba la versión al arrancar).
- Git en el `PATH`, con acceso al remoto `origin` de cada repositorio.
- Ollama activo en `ollama_host` (por defecto `http://localhost:11434`) con `qwen2.5:3b` como mínimo.
- Email de Jira + API Token clásico (un token *with scopes* no funciona contra `*.atlassian.net`).
- Permisos de escritura en `%APPDATA%\DevFlowCLI\` (base SQLite) y en la raíz de tickets (`%USERPROFILE%\DevFlowCLI\tickets\`).

> Procedimiento de instalación concreto: ver hueco **H-05**.

### 1.2 Primer arranque en frío — `✅ Implementado y probado` · TK-01, TK-02a (probado en Windows el 2026-11-05 con Jira y Git reales; el `bin` de `devflow` llega en el Hito 3)

- `getAppConfig()` devuelve `null` sin lanzar excepción (TK-01 CA6).
- `SQLiteStorageManager` aplica las migraciones de forma idempotente (TK-01 CA7) y crea `devflow.db` en modo **WAL** con las 4 tablas: `app_config`, `jira_projects`, `repositories`, `ticket_logs`.
- La configuración se resuelve **una sola vez** al arrancar y el Orquestador la inyecta por constructor a Jira, Ollama, Git y FileSystem. Ningún componente de integración lee SQLite.

### 1.3 `devflow config` — sufijo de usuario y credenciales — `✅ Implementado y probado` · US-01 CA4 · TK-02g, TK-03a (probado en Windows el 2026-11-05 con Jira y Git reales; el `bin` de `devflow` llega en el Hito 3)

1. El usuario escribe la URL de Jira, el email, el API Token (enmascarado, nunca se muestra) y la carpeta de tickets (por defecto `%USERPROFILE%\DevFlowCLI\tickets`). La URL se valida (solo `http(s)`, sin usuario, parámetros ni fragmento) y se guarda su `origin`. Con una configuración existente, esos valores son los predeterminados y un token en blanco conserva el guardado.
2. En el primer arranque, el Orquestador llama a `GET /myself` con esas credenciales **aún sin guardar** (el primer alta exige el sufijo), toma el `displayName` y propone el sufijo: inicial del nombre + último apellido, sin acentos y en mayúsculas (p. ej. `AROCHA`).
3. El usuario confirma o edita; se guarda como `branch_user_suffix`. El sufijo es configurable por cada desarrollador (p. ej. `AROCHA`, `PGOMEZ`) y `saveConfig` rechaza el que no cumpla `^[A-Z0-9]+$`. Si Jira no puede sugerirlo (token inválido, sin respuesta o un nombre sin caracteres válidos), se muestra el motivo y el usuario lo escribe a mano; no se aborta. Todo se guarda en una sola llamada.

> Los nombres de los comandos `devflow config` y `devflow config proyectos` están decididos (hueco **H-06**, resuelto). El token se guarda en claro en `app_config` en el MVP (H-05, decidido; ver `002` §2.5).

### 1.4 `devflow config proyectos` — claves y repositorios — `✅ Implementado y probado` · US-01 CA1-3, CA5-6 · TK-02b, TK-02c, TK-02g/TK-03a (probado en Windows el 2026-11-05 con Jira y Git reales; el `bin` de `devflow` llega en el Hito 3)

- **Alta de clave:** se valida con `GET /rest/api/2/project/{key}` (la JQL ignora sin error las claves inexistentes). Ante un 404 se llama a `/myself`: **401 = token inválido**, **200 = la clave no existe**. Se guarda con el nombre del proyecto.
- **Alta de repositorio** (0..N por clave): nombre (`backend`), ruta local y rama base (por defecto `main`). `GitManager.validateRepository` comprueba que sea un repo Git con remoto `origin` y que la rama base exista en el remoto.
- **Edición:** *upsert* por `jira_project_key` y por `(jira_project_id, name)`; no quedan duplicados (TK-01 CA2). Borrar una clave borra en cascada sus repositorios (TK-01 CA3).
- **Guarda:** sin ninguna clave configurada, `devflow start` indica que hay que dar de alta al menos una (US-01 CA6; cerrado en `devflow start`, TK-03b1).
- **Menú:** `devflow config proyectos` es un menú interactivo que se repite hasta elegir «Salir» (listar, agregar clave, agregar/editar/quitar repositorio, quitar clave). Quitar algo pide confirmación. Si Git rechaza un repositorio, se muestra el motivo y se ofrece corregir sin perder lo escrito.
- **Fallos de Jira:** clave inexistente, **token inválido (sin decir que la clave no existe)** y Jira sin respuesta tienen mensajes distintos.
- **Baja con historial:** quitar una clave o un repositorio con tickets en `ticket_logs` se rechaza con un mensaje claro (no el error de SQLite) y no borra nada (TK-02g).

**Resiliencia:** clave inválida, ruta que no es repo Git o rama base inexistente → se rechaza el alta con el motivo. No queda estado parcial.

---

## 2. 📋 Selección y consulta del ticket

**Historias:** US-02 · **Tickets:** TK-02 (Jira/Orquestador), TK-03 (prompts)

### 2.1 Entrada — `devflow start [ID] [--base rama] [--reprocesar]` — `🚧 En desarrollo` · TK-03b1 (comando, validación del ID, lista de asignados y flags implementados; la carga manual y la confirmación ya funcionan (TK-03b2); falta el spinner y las pantallas de resultado, TK-03b3)

- **Sin ID:** la TUI llama a `TicketOrchestrator.listAssignedTickets()`. El cliente Jira ejecuta
  `project in (…) AND assignee = currentUser() AND statusCategory != Done AND issuetype != Epic ORDER BY updated DESC` y el usuario elige uno (US-02 CA1).
- **Con ID:** la TUI valida el formato `^[A-Za-z][A-Za-z0-9_]*-\d+$` (el mismo del Orquestador, que normaliza a mayúsculas) antes de invocar al Orquestador; si es inválido, muestra el error sin llamar a nada (TK-03 CA1).

### 2.2 Validación de clave y selección de repositorio — `✅ Implementado y probado` · US-02 CA3 · TK-02/TK-03b1 (probado con tests y el Orquestador simulado; aún no con el Jira real)

- `listRepositoriesForTicket(ID)` deriva la clave del ID. Si la clave **no está configurada**, falla **antes de llamar a Jira** y muestra las claves disponibles.
- Si la clave tiene varios repositorios, el usuario elige uno; con uno solo se preselecciona; sin repositorios no hay selección y no se pasa `repositoryId` (TK-03 CA4).
- **Un repositorio por ejecución.** Un ticket que toca varios se ejecuta una vez por repositorio, en secuencia.

### 2.3 Consulta a Jira — `✅ Implementado y probado` · US-02 CA2 · TK-02b, TK-02f (cliente integrado en `startTicket`; el nombre de la cuenta se pide además para el encabezado del documento)

- `GET /rest/api/2/issue/{id}?fields=summary,description,issuetype`, con Basic email + token.
- La `description` llega en texto plano y se mapea de forma determinista a `ContextoTicket` (sin LLM).
- Un reintento con backoff corto (~2 s) ante timeout. Un cuerpo 2xx con campos de tipo incorrecto, una URL base inválida o una clave de proyecto con formato inválido (en `listAssignedTickets`) dan `ErrorBloqueante('ErrorInesperado')`, nunca una excepción.

### 2.4 Fallback manual — `✅ Implementado y probado` · US-02 CA4-5 · TK-02b, TK-02f/TK-03b2 (la clasificación de fallos del cliente Jira, la llamada a `ask({ kind: 'manualTicket' })` del Orquestador y el prompt de la TUI están implementados y probados con tests y prompts simulados; la prueba interactiva con Jira caído queda para la aceptación del Hito 3. El prompt pregunta «¿Es un bug?» y `ManualTicketAnswer` lleva un `issueType` opcional, para que un bug cargado a mano use la plantilla `bug`)

| Causa | Detección | Resultado |
|---|---|---|
| Red caída | Timeout persistente tras 1 reintento | `FallbackManual('network_timeout')` |
| Token inválido | 401/403, o 404 + `/myself` 401 | `FallbackManual('invalid_token')` |
| Ticket inexistente | 404 + `/myself` 200 | `FallbackManual('not_found')` |
| Límite de peticiones | 429 | Se respeta `Retry-After` antes de fallar |

El Orquestador invoca `ask({ kind: 'manualTicket', reason })`; la TUI abre `ManualTicketEntryPrompt` con el motivo, el usuario ingresa título y descripción y el flujo continúa con `source: 'manual'` y `jira_fetch_status = 'fallback_manual'`.

### 2.5 Resolución del tipo de issue — `✅ Implementado y probado` · US-02 CA6 · TK-02a, TK-02f (`resolveIssueType`; `startTicket` lo invoca tras obtener el ticket y antes de la confirmación)

Según `templates/issue-types.json`:

- **Épica / Epic** → `ErrorBloqueante('TipoIssueBloqueado')`: aviso de que no tiene plantilla; **sin** rama, carpeta, documento ni registro en `ticket_logs`.
- **Bug / Error / Defecto** → plantilla `bug`, prefijo de rama `bugs/`.
- **Resto** (historia, tarea, subtarea…) → plantilla `historia`, prefijo `features/`.

---

## 3. 🛠️ Preparación automática del entorno

**Historias:** US-03 · **Tickets:** TK-02

**Confirmación (H-03):** tras obtener el ticket, resolver su tipo y ejecutar la inspección de solo lectura del repositorio (3.1, pasos 1-3), y antes de cualquier escritura en Git, disco u Ollama, el Orquestador pide una única confirmación (`ask` `confirmActions`) con rama, base, carpeta y si la rama ya existe. Un repositorio inexistente, con cambios pendientes o con la rama solo en el remoto corta el flujo **antes** de pedir confirmar; si la rama ya existe en local, la confirmación consulta si se usa la misma. Si el desarrollador cancela, no se crea nada ni se escribe en `ticket_logs`.

Cada paso emite `onStep(paso, estado)` hacia la TUI para el spinner. Si la clave **no tiene repositorios**, el paso Git se omite y solo se genera el documento (US-03 CA7).

### 3.1 Git Manager (ADR-007.1) — `✅ Implementado y probado` · US-03 CA1-3, CA5, CA8 · TK-02

Rama: `<prefijo>/<ID>-<SUFIJO>` (p. ej. `features/SCRUM-1-AROCHA`).

Los pasos 1-3 son de **solo lectura** (`GitManager.inspectRepository`) y se ejecutan **antes** de la confirmación; los pasos 4-5 (`createBranch`) van **después**, y `createBranch` repite el `git status` por seguridad.

1. **Verifica el repositorio.** Si no existe → `ErrorBloqueante('RepositorioNoEncontrado')`.
2. **`git status --porcelain`.** Con cambios pendientes (modificados, staged o sin trackear) o con un merge, rebase, cherry-pick o revert en curso → `ErrorBloqueante('CambiosPendientes')` con la lista de archivos; se registra `branch_status = 'pending_changes'` y se corta **antes de crear nada**. No hay `stash` automático.
3. **Rama ya existente.**
   - **En local** → `Ok(alreadyExisted)`; la confirmación avisa que existe y consulta si se usa la misma (si no, se cancela). Si se acepta, continúa con carpeta y documento, sin pull ni creación; no cambia de rama (H-04 resuelto).
   - **Solo en `origin`** (`git ls-remote --heads`, solo lectura) → `ErrorBloqueante('RamaExistenteEnRemoto')` antes de la confirmación, `branch_status = 'error'`; el usuario la verifica y la configura a mano. La app **nunca crea ni publica ramas en el remoto** (el `push` es del usuario).
4. **Actualiza la rama base** sin importar la rama actual:
   - si no está parado en la base (otra rama o HEAD desacoplado): `git switch <base>`;
   - luego `git pull --no-rebase --ff-only origin <base>`. Si el pull falla, el repositorio queda parado en la base. La app no hace `fetch`: la base debe existir en local o como `origin/<base>` ya traída; si solo está en el servidor, el error pide ejecutar `git fetch origin`.
   Si falla (sin red, historial divergente, credenciales) → `ErrorBloqueante('PullFallido')`, `branch_status = 'error'`. **Nunca** se ramifica desde una base desactualizada.
5. **Crea la rama:** `git switch -c <rama> <base>`. `--base` aplica solo a esta ejecución y no cambia la configuración del repositorio.

**Garantía:** nunca `commit`, `add` ni `push`; ningún archivo versionado se modifica.

### 3.2 FileSystem Manager — carpetas — `✅ Implementado y probado` · ADR-004.1 · TK-02d, TK-02f (`createTicketWorkspace`; `startTicket` lo invoca tras crear la rama)

- Crea `<raíz de tickets>\ID\<repositorio>\adjuntos\` **fuera del repositorio Git** (clave sin repos: solo el documento, sin subcarpeta de repositorio).
- Falta de permisos (antivirus, OneDrive, ruta bloqueada) → `ErrorBloqueante('PermisosInsuficientes')`: se detiene ese paso y se reporta qué se alcanzó a completar.

---

## 4. 🤖 Generación asistida por IA y documento de Fase 1

**Historias:** US-03 · **Tickets:** TK-02

### 4.1 Reutilización y reproceso de Fase 1 — `✅ Implementado y probado` · US-03 CA6, CA9 · TK-02h (se separó de TK-02f el 2026-11-06; la opción `--reprocesar` ya está registrada en la línea de comandos, TK-03b1)

- Si existe `ID\.devflow\fase1.json` (el ticket ya se ejecutó con otro repositorio) → se reutiliza, `ollama_status = 'reused'`, **no se invoca a Ollama**.
- Si es la primera ejecución del ticket → 4.2.
- Si el `fase1.json` existente fue generado en **fallback** (`generatedByOllama: false`), no se reutiliza: se reintenta con Ollama (4.2) automáticamente.
- Con **`--reprocesar`** (H-02) se ignora el `fase1.json` y se vuelve a invocar a Ollama (4.2). Si el nuevo intento es válido, sobrescribe `fase1.json` y reemplaza solo el bloque de Fase 1 del documento del repositorio elegido; si cae en fallback, **se conserva la Fase 1 válida anterior**. Los documentos de otros repositorios del ticket no se tocan.

### 4.2 Ollama AI Transformer — `✅ Implementado y probado` · ADR-003.1 · TK-02e, TK-02f (`OllamaAITransformer.processContext`; `startTicket` lo invoca y guarda `fase1.json` si responde bien)

- Prompt armado con archivos versionados de `templates/prompts/` (`comun.system.md`, `<tipo>.system.md`, `ticket.user.md`).
- `POST /api/generate` con *streaming* y el JSON Schema del tipo en `format`; el spinner de la TUI muestra un texto fijo («puede tardar ~1 min»), sin progreso del *streaming* (decidido el 2026-11-12; el progreso real queda como mejora posterior). Modelo `qwen2.5:3b`, `ollama_timeout_seconds` = 120, `keep_alive` corto.
- El primer campo del schema es `presenteEnTicket`: el modelo clasifica qué datos existen antes de redactar. Un booleano por campo del tipo; queda opcional en `DocumentoFase1` para no invalidar Fases 1 guardadas antes de TK-02e.
- El timeout es **total** (incluye el streaming) y `onToken` recibe el total acumulado de caracteres. `temperature` 0 y `keep_alive` de 30 s por defecto.
- Comprobado con `qwen2.5:3b` real en WSL (solo CPU): 14 a 56 s por ticket. Un modelo de 3B es conservador: prefiere marcar «ausente» a arriesgar, y la historia de usuario (`como/quiero/para`) solo se rellena si el ticket la trae completa.

### 4.3 Validación y posprocesado — `✅ Implementado y probado` · TK-02e (CA2)

- Validación con **Ajv** contra el mismo schema (fuente de verdad).
- Posprocesado determinista (`src/services/ollama/postprocess.ts`, reglas por tipo en `templates/issue-types.json`): `siFalta` sobrescribe los datos ausentes con *"No especificado en el ticket."* (una lista de escenarios queda vacía) y agrega la pregunta abierta, una sola vez; `verificarLiterales` (solo bugs) descarta el elemento (paso, escenario) que contiene un número o un texto entre comillas que no esté en el ticket, y pasa a ausente el campo de texto que lo contiene.
- Contenido por tipo — **historia:** `historiaUsuario{como,quiero,para}`, `casosDeUso[]`, `escenarios[]` Gherkin, `preguntasAbiertas[]`. **Bug:** `pasosParaReproducir[]`, `comportamientoEsperado`, `comportamientoActual`, `entorno`, escenarios y preguntas.
- Cualquier bloque de código embebido invalida la respuesta (Non-Goal "cero código generado").

### 4.4 Fallback determinista — `✅ Implementado y probado` · US-03 CA4 · TK-02e, TK-02f (el transformer devuelve `FallbackDeterminista(rawText)` ante cualquier fallo y nunca lanza; `startTicket` escribe el documento marcado `⚠️ Generado sin Ollama`, no guarda `fase1.json` y registra `ollama_status = 'fallback_deterministic'`)

- Se activa ante: Ollama caído, modelo no instalado, timeout de 120 s, JSON mal formado o con campos faltantes, o código embebido.
- Resultado: `FallbackDeterminista(rawText)` → el texto crudo de Jira va en las secciones de Fase 1, marcado `⚠️ Generado sin Ollama — completar manualmente`.
- La rama y las carpetas **ya fueron creadas**: el flujo no se bloquea.
- `rawText` es el título, una línea en blanco y la descripción. El transformer no informa la causa del fallo: registrarla en `ticket_logs.ollama_error` exigiría ampliar `StepResult` (TK-02a).

### 4.5 Renderizado del documento — `✅ Implementado y probado` · TK-02d, TK-02f (`writeDocument`, `saveFase1` y `readFase1`, que `startTicket` invoca; la regeneración de la Fase 1 con `regenerateFase1Only` la usa TK-02h)

- `FileSystemManager.writeDocument` combina el encabezado y la Fase 1 con la Fase 2 de la plantilla del tipo (Handlebars: `bug.md.hbs` / `historia.md.hbs`, basadas en la `plantilla-user-story.md` de la desarrolladora; la Fase 2 va vacía y la IA no la toca). Si el documento ya existe y no se pide regenerar, no lo toca.
- La Fase 1 queda delimitada por `<!-- DEVFLOW:FASE1:INICIO -->` / `<!-- DEVFLOW:FASE1:FIN -->`. Con `regenerateFase1Only` solo se reemplaza el texto entre los marcadores; el encabezado y la Fase 2 quedan byte a byte iguales.
- Se guarda `ID\.devflow\fase1.json` para reutilizarla con otro repositorio.

---

## 5. 📝 Fase 2 del desarrollador y registro de métricas

**Tickets:** TK-01 (SQLite), TK-02 (Orquestador, FileSystem), TK-03 (resumen)

### 5.1 Registro en `ticket_logs` — `📄 Especificado` · TK-01 CA4, CA8 · TK-02 CA5

- El Orquestador es el **único** escritor, **una vez al terminar el flujo** (también cuando se corta en Git).
- *Upsert* por `(ticket_id, repository_id)`; con `repository_id = NULL` (clave sin repos) se trata aparte, porque `UNIQUE` no deduplica NULL.
- Campos clave: `branch_status`, `jira_fetch_status`, `ollama_status` (`ok | fallback_deterministic | reused | NULL`), `prompt_version`, `folder_path`, `document_path`, `started_at`, `finished_at`.
- Si el flujo se cortó en Git: `folder_path`, `document_path` y `ollama_status` = `NULL`; la reejecución posterior actualiza esa misma fila.
- Alimenta la métrica **tasa de éxito sin fallback** del PRD.
- El cierre de la Fase 2 **no se registra** en el MVP (H-01, resuelto como fuera de alcance; ver `PRD` §4).

### 5.2 Resumen en la TUI — `📄 Especificado` · TK-03b3 CA6-8

- Éxito: rama, carpeta y documento — "Ticket ID listo para trabajar".
- Avisos distinguibles: `⚠️ Generado sin Ollama`; "análisis reutilizado" (`reused`); pantallas de bloqueo (cambios pendientes con archivos, pull fallido, épica, repositorio no encontrado). Un resumen con `blocked` **nunca** muestra pantalla de éxito.

### 5.3 Fase 2 manual (fuera de la herramienta) — `📄 Especificado` · PRD §3

El desarrollador abre el documento en su IDE y completa: **Datos del desarrollo** (tablas, stored procedures, backend, frontend y otros), **Evidencias** (pruebas unitarias y evidencias de funcionamiento, con enlaces a `adjuntos/`) y **Observaciones**. Cualquier bloque de código lo ingresa él, nunca el LLM. QA y DevOps encuentran la misma estructura y ubicación en todos los tickets del mismo tipo.

### 5.4 Reejecución e idempotencia — `📄 Especificado` · TK-02 CA4

- Reprocesar un ticket (`--reprocesar`) regenera **solo** el bloque entre los marcadores de Fase 1; el contenido de Fase 2 ya escrito se preserva intacto.
- Con otro repositorio del mismo ticket se repite el flujo en secuencia: carpeta, documento y fila de `ticket_logs` propios, con la Fase 1 copiada de `fase1.json`.

---

## 6. Mapa de resiliencia

| Escenario | Origen | Resultado | ¿Continúa el flujo? | Ref. |
|---|---|---|---|---|
| Sin red / token inválido / ticket inexistente | Jira | `FallbackManual` + `ask()` | ✅ con datos manuales | US-02 CA4-5 · TK-02 |
| Épica | Orquestador | `TipoIssueBloqueado` | ❌ aviso, sin artefactos ni log | US-02 CA6 · TK-02 |
| Clave no configurada | Orquestador | Error previo a Jira | ❌ lista las claves | US-02 CA3 · TK-02 |
| Repositorio inexistente | Git | `ErrorBloqueante` | ❌ | TK-02 CA3 |
| Cambios pendientes | Git | `ErrorBloqueante` + archivos | ❌ log `pending_changes` | US-03 CA2 · TK-02 |
| Pull fallido | Git | `ErrorBloqueante` | ❌ log `error` | US-03 CA3 · TK-02 |
| Rama ya existente en local | Git | `Ok(alreadyExisted)` + consulta en la confirmación | ✅ si el usuario acepta; sin pull ni creación | US-03 CA5 · TK-02 |
| Rama existente solo en `origin` | Git | `ErrorBloqueante('RamaExistenteEnRemoto')` | ❌ log `error`; el usuario la configura a mano | US-03 CA10 · TK-02 |
| Ollama caído / timeout / JSON inválido / con código | Ollama | `FallbackDeterminista` | ✅ documento con `⚠️` | US-03 CA4 · TK-02 |
| Sin permisos de disco | FileSystem | `ErrorBloqueante` | ❌ reporta lo completado | TK-02 |

---

## 7. Huecos abiertos

Detectados al cruzar las fuentes (análisis pre-código, 2026-11-01). Cada uno indica **dónde resolverlo**. Al cerrarlo: actualizar la fuente, este archivo, y pasar el estado a ✅ con fecha y referencia.

| ID | Hueco | Dónde resolverlo | Estado |
|---|---|---|---|
| **H-01** | **Las métricas se registran antes de la Fase 2.** `ticket_logs` se escribe al cerrar la Fase 1; ningún evento registra cuándo el desarrollador completa la Fase 2, por lo que la herramienta no puede medir "documentación completada". Decidir: fuera del MVP, o un comando/estado de cierre (¿nueva columna en `ticket_logs`?). | **TK-01** (esquema `ticket_logs`, `003-modelo-de-datos.md`) y **TK-02** (Orquestador). Posible nueva US si se incorpora. | 🟢 Resuelto (2026-11-01): fuera del MVP; registrado como no objetivo en `PRD` §4. `ticket_logs` no cambia. |
| **H-02** | **No hay mecanismo para pedir el reproceso de la Fase 1.** `002` §2.2 dice que se regenera "si el usuario lo pide" o si la primera vez cayó en fallback, pero ni TK-02 ni TK-03 definen flag o prompt (`--reprocesar`, confirmación…). Tampoco qué pasa con `fase1.json` previo. | **TK-03** (comando/flags de `start`) y **TK-02** (`writeDocument` con `regenerateFase1Only`, `FileSystemManager.saveFase1`). Revisar **US-03** (falta un criterio de reproceso). | 🟢 Resuelto (2026-11-02): flag `--reprocesar` en `devflow start` (`reprocessFase1` en `startTicket`); regenera la Fase 1, sobrescribe `fase1.json` solo si el intento es válido y reemplaza únicamente el bloque de Fase 1 del documento del repositorio elegido. Una Fase 1 previa en fallback se reintenta sola. Nuevo US-03 CA9; actualizados `002`, `005` y `006`. |
| **H-03** | **`ConfirmActionsPrompt` no está en el diagrama de secuencia.** TK-03 define una confirmación única antes de actuar (*ambiguo*), pero el diagrama E2E de `002` §2.1 no la incluye, ni dice si se puede cancelar. | **TK-03** (contrato `ConfirmActionsPrompt`) y diagrama Mermaid de `002` §2.1 (actualizar ambos juntos). | 🟢 Resuelto (2026-11-02): una única confirmación con resumen (rama, base, carpeta), pedida por el Orquestador vía `ask` después de resolver el tipo de issue y antes de tocar Git/disco/Ollama; cancelable, sin efectos ni `ticket_logs`. Actualizados `002` §2.1 y `006` (TK-02f, TK-03b). Matiz (2026-11-02): la inspección de solo lectura de Git (repo, `git status`, ¿existe la rama?) se ejecuta **antes** de la confirmación; `fetch`/`pull`/`switch` van después. |
| **H-04** | **Rama ya existente: sin acción adicional.** US-03 CA5 queda *ambiguo*: solo informa y continúa. No se define qué pasa con el checkout (¿queda en la rama actual?), ni si se ofrece cambiar a esa rama. | **US-03 CA5** y **TK-02** (`GitManager.createBranch`, CA3). | 🟢 Resuelto (2026-11-02): solo informa y continúa; **no hay checkout** — el repositorio queda en la rama en la que estaba y no se ofrece ninguna acción adicional. |
| **H-05** | **Instalación y manejo del token sin definir.** `001` §1.4 y README §1.4 están `[A definir]`; tampoco se decide si el API Token se guarda en claro o cifrado (DPAPI) ni su rotación (`002` §2.5). | **TK-01** (columna `jira_api_token` de `app_config`), **`001` §1.4 / README §1.4**, **`002` §2.5**. Posible ADR nuevo. | 🟡 Parcial: el token se guarda **en claro** en el MVP (decisión 2026-11-01, `002` §2.5 y `003`); falta redactar las instrucciones de instalación (`001` §1.4 / README §1.4). |
| **H-06** | **Comandos de configuración *asumidos*.** `devflow config` / `devflow config proyectos` son una propuesta de TK-03; ningún documento base define cómo se ejecuta US-01. Pendiente de validar con el equipo (DoD de TK-03). | **TK-03** (`config.command.ts`) y **US-01** (agregar el comando a los criterios). | 🟢 Resuelto (2026-11-02): se mantienen `devflow config` (token, sufijo, datos de Jira) y `devflow config proyectos` (claves y repositorios). Los flags y subcomandos concretos se fijan al refinar TK-03a. Resuelto al refinar (2026-11-05): sin flags de configuración, ambos son interactivos; solo `--help` y `--version`. |

---

## Registro de cambios

| Fecha | Cambio | Ref. |
|---|---|---|
| 2026-11-01 | Creación del documento a partir del análisis del flujo pre-código (fuentes: 001, 002, 005, 006, PRD, README). Se registran H-01 a H-06. | — |
| 2026-11-01 | H-01 resuelto (cierre de Fase 2 fuera del MVP) y H-05 parcial (token en claro en el MVP; falta la instalación). Actualizados `PRD` §4, `002` §2.5 y `003` (`jira_api_token`). | H-01, H-05 · TK-01 |
| 2026-11-01 | Nuevo ticket TK-00 (scaffold del proyecto) en `006`; TK-01 pasa a depender de TK-00. No cambia el flujo funcional: es un prerrequisito de implementación. | TK-00 |
| 2026-11-02 | TK-02 dividido en TK-02a … TK-02g en `006` (a: base compartida · b: Jira · c: Git · d: FileSystem · e: Ollama · f: flujo del Orquestador · g: gestión de configuración). Las referencias a «TK-02» en este documento se leen como el conjunto; no cambia el flujo. | TK-02a…g |
| 2026-11-02 | H-04 resuelto: rama existente → solo informar, sin checkout. Actualizado `005` US-03 CA5. | H-04 · US-03 · TK-02c |
| 2026-11-02 | H-06 resuelto: nombres `devflow config` y `devflow config proyectos` confirmados. Actualizado `006` (TK-03). | H-06 · US-01 · TK-03a |
| 2026-11-02 | H-03 resuelto: confirmación única y cancelable en el flujo `startTicket`; agregada al diagrama de `002` §2.1 y a los contratos de `006`. | H-03 · TK-02f · TK-03b |
| 2026-11-02 | H-03 afinado: nuevo `GitManager.inspectRepository` (solo lectura) antes de la confirmación; `createBranch` después. Actualizados `002` §2.1, `006` (TK-02c, TK-02f, TK-03b) y §3.1 de este documento. | H-03 · TK-02c · TK-02f · TK-03b |
| 2026-11-02 | H-02 resuelto: `--reprocesar` en `devflow start`; agregado US-03 CA9 en `005`, y ajustados `002`, `006` (TK-02f, TK-03b) y este documento. | H-02 · US-03 · TK-02f · TK-03b |
| 2026-11-03 | Regla de rama existente de TK-02c: en local → aviso y consulta en la confirmación; solo en `origin` → `ErrorBloqueante('RamaExistenteEnRemoto')` (nuevo subtipo); nunca se crea ni publica en el remoto. Nuevo US-03 CA10 y CA5 ajustado en `005`; actualizados `002`, `006` (TK-02c, TK-02f, TK-03b) y este documento. | H-04 · US-03 · TK-02c · TK-02f · TK-03b |
| 2026-11-04 | Revisión de la PR #3 (TK-02c): el pull de la base lleva `--no-rebase` (ignora `pull.rebase`); los nombres de rama y base se validan con `git check-ref-format` antes de usarlos en `ls-remote` y `fetch`; el runner de Git tiene timeout. Actualizados `002`, `006`, ADR-007.1, `CLAUDE.md` y este documento. | TK-02c |
| 2026-11-03 | TK-02a y TK-02b implementados: `StepResult`, `AppConfigProvider`, resolutor de tipo de issue (`branchType`; el prefijo lo arma el Orquestador) y cliente REST de Jira (búsqueda por `/rest/api/2/search/jql`, porque `/search` responde 410). Actualizados el estado del proyecto y los pasos 1.2, 1.4, 2.3, 2.4 y 2.5. | TK-02a · TK-02b |
| 2026-11-04 | TK-02c implementado: `GitManager` (`inspectRepository`, `createBranch`, `validateRepository`) con la secuencia de ADR-007.1; paso 3.1 pasa a ✅. 197 tests, cobertura de `git-manager.ts` 96 % / 93 %. Commits `6fda82b`, `7bd9809`, `bda73e9`, `a406501`. | 3.1 · TK-02c |
| 2026-11-04 | 2.ª revisión de la PR #3 (TK-02c): se elimina el `fetch origin <base>:<base>` (podía escribir tags); ahora `git switch <base>` + `git pull`, como el flujo manual. Se rechazan nombres que empiezan por `refs/`, se detecta merge/rebase/cherry-pick/revert en curso (`CambiosPendientes`) y los mensajes ocultan usuario y token de las URLs. Actualizados ADR-007.1, `002`, `006`, `CLAUDE.md` y este documento. | TK-02c |
| 2026-11-04 | 3.ª pasada de la revisión de la PR #3 (TK-02c): la base que solo existe en el remoto da un error que pide `git fetch origin` (sin volver a hacer `fetch`); se valida la lectura de la rama actual; el runner distingue `maxBuffer` del timeout; el `PullFallido` dice en qué rama quedó el repositorio. Actualizados ADR-007.1, `002`, `006`, el contrato y este documento. | TK-02c |
| 2026-11-05 | TK-02d implementado: `FileSystemManager` (`createTicketWorkspace`, `writeDocument`, `saveFase1`, `readFase1`), `LocalFileStorage` y plantillas `bug.md.hbs` / `historia.md.hbs` basadas en la plantilla de la desarrolladora. La Fase 2 pasa a ser «Datos del desarrollo, Evidencias y Observaciones» (se quita «Instrucciones de Pasaje a Producción»). Pasos 3.2 y 4.5 a ✅. Actualizados `PRD`, `001`, `002`, `006` y este documento. | 3.2 · 4.5 · TK-02d |
| 2026-11-05 | TK-02g implementado: `TicketOrchestrator` con `listProjects`/`addProject`/`removeProject`, `addRepository`/`updateRepository`/`removeRepository`/`listRepositoriesForTicket`, `getConfig`/`saveConfig`, `suggestBranchSuffix` y `listAssignedTickets`. El alta solo persiste si Jira o Git validan; la baja con historial da un mensaje claro. Pasos 1.3 y 1.4 siguen en desarrollo hasta la TUI (TK-03a). 327 tests. Commit `0cf542a`; la revisión de Cursor corrigió la normalización de la clave en `removeProject`, la rama base en la re-alta y el recorte y la validación de los datos del repositorio (347 tests). | 1.3 · 1.4 · TK-02g |
| 2026-11-05 | TK-03a implementado: `cli.ts` (Commander) con `devflow config` (URL, email, token enmascarado, carpeta de tickets y sufijo sugerido con credenciales aún sin guardar) y `devflow config proyectos` (menú de claves y repositorios), `createOrchestrator`, `listRepositories`, validación de `jiraBaseUrl` y `npm start`. Comprobado contra el Jira real y un `origin` real desde WSL (solo lectura); falta la prueba interactiva en Windows. Pasos 1.2, 1.3 y 1.4 siguen en desarrollo hasta esa prueba. 431 tests. Commits `bc0a5a8`, `58ee60e` y `24d7a98`; la revisión de Cursor añadió `TicketOrchestrator.close()`. | 1.2 · 1.3 · 1.4 · H-06 · TK-03a |
| 2026-11-05 | TK-02e implementado: `OllamaAITransformer` (streaming, schema en `format`, validación con Ajv, fallback determinista ante cualquier fallo), prompts y schemas en `templates/prompts/`, y posprocesado `siFalta` / `verificarLiterales` con las reglas en `issue-types.json`. Comprobado con `qwen2.5:3b` real; se afinó el prompt de bug. Pasos 4.2 y 4.3 a ✅; 4.4 sigue en desarrollo hasta TK-02f. 505 tests (508 tras la revisión de Cursor, que corrigió la última línea del streaming sin salto de línea). Commit `401f9b6`. | 4.2 · 4.3 · 4.4 · TK-02e |
| 2026-11-05 | Prueba en Windows (nativo, PowerShell) de TK-03a con el Jira y los repositorios reales de la desarrolladora: `typecheck`, `lint` y 507 de 508 tests (el que falló era un timeout de 5 s en un `git pull` contra un puerto cerrado, más lento en Windows; corregido con un timeout propio), `devflow config` y `devflow config proyectos` completos, base en `%APPDATA%`. Pasos 1.2, 1.3 y 1.4 a ✅. Pendiente para el Hito 3: el `bin` de `devflow` (el mensaje final de `config` nombra un comando que aún no existe). | 1.2 · 1.3 · 1.4 · TK-03a |
| 2026-11-06 | TK-02f dividido: el flujo `startTicket` (núcleo) queda en TK-02f y la reutilización y el reproceso de la Fase 1 (US-03 CA6 y CA9) pasan a TK-02h, que depende de TK-02f; TK-03b depende de ambos. Actualizados `006`, el backlog, el README y el paso 4.1 de este documento. | 4.1 · TK-02f · TK-02h |
| 2026-11-06 | TK-02f implementado: `TicketOrchestrator.startTicket` (Jira o carga manual → tipo → inspección de Git → confirmación única → rama → carpeta → Ollama → documento) con registro en `ticket_logs`, todos los cortes y la cancelación; tipos en `src/shared/types/ticket-run.types.ts`. Probado con Git, carpetas y SQLite reales y, a mano, con el Jira y Ollama reales. La reutilización y el reproceso de la Fase 1 siguen para TK-02h. Pasos 2.3, 2.5, 3.2, 4.2, 4.4 y 4.5 actualizados. 551 tests (558 tras la revisión de Cursor). Commit `2a2859a`. | 2.3 · 2.4 · 2.5 · 3.2 · 4.2 · 4.4 · 4.5 · TK-02f |
| 2026-11-06 | TK-02h implementado: `startTicket` reutiliza la Fase 1 guardada (`fase1.json`) con otro repositorio sin llamar a Ollama (`ollama_status = 'reused'`), la reprocesa con `reprocessFase1` regenerando solo el bloque de Fase 1 y conservando la Fase 2 a mano, conserva la anterior si el reproceso cae a fallback, y reintenta sola si la Fase 1 previa quedó sin redactar, ausente o ilegible. El documento se escribe antes que `fase1.json`. Probado con Git real y, a mano, con Ollama y Jira reales. Paso 4.1 a ✅. 580 tests. | 4.1 · 4.5 · TK-02h |
| 2026-11-12 | TK-03b dividido en TK-03b1 (núcleo: validación, selección y registro del comando), TK-03b2 (`ask`: carga manual con tipo de issue y confirmación) y TK-03b3 (progreso y pantallas); nuevo TK-02i (plantillas: «No especificado en el ticket.»). Decidido: el spinner de Ollama muestra un texto fijo, sin gancho de progreso; la carga manual pregunta «¿Es un bug? (s/N)». Actualizados `006`, `002`, el backlog, el README y los pasos 2.1, 2.2, 2.4, 4.1, 4.2 y 5.2. | 2.1 · 2.4 · 4.2 · 5.2 · TK-03b · TK-02i |
| 2026-11-12 | TK-03b1 implementado: `devflow start [ID] [--base] [--reprocesar]` registrado en `cli.ts`; valida el ID con el mismo criterio del Orquestador, avisa si no hay claves (US-01 CA6), muestra la lista de asignados, elige el repositorio (varios, uno o ninguno) y pasa los flags a `startTicket`. Los ganchos `onStep` y `ask` son provisionales hasta TK-03b2 y TK-03b3. Un test aprobado de TK-03a (`cli.test.ts`) se actualizó con autorización. 628 tests. Pasos 2.1 y 2.2 actualizados. | 2.1 · 2.2 · TK-03b1 |
| 2026-11-12 | TK-03b2 implementado: la carga manual de `devflow start` pregunta título, descripción y «¿Es un bug?» (el Orquestador usa la plantilla `bug` y la rama de bugfix con `issueType`), explica el motivo del fallo de Jira y la confirmación única muestra ticket, tipo, repositorio, rama, base y carpeta (aviso de rama existente, `--reprocesar` y clave sin repositorios) y, si se cancela, informa que no se creó nada. Un test aprobado de TK-03b1 (`cli.test.ts`) se actualizó con autorización. 655 tests. Paso 2.4 a ✅; el 2.1 espera solo a TK-03b3. | 2.1 · 2.4 · TK-03b2 |
