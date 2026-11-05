# 009. Flujo funcional de DevFlow CLI

> **Documento vivo.** Describe, paso a paso, cómo se comporta DevFlow CLI desde la instalación inicial hasta que el desarrollador completa la documentación de un ticket. Se actualiza a medida que se implementa el código.
>
> Fuentes de verdad: `docs/PRD.md`, `docs/001-descripcion-general-del-producto.md`, `docs/002-arquitectura-del-sistema.md`, `docs/005-historias-de-usuario.md`, `docs/006-tickets-de-trabajo.md`, `docs/ADR-001-arquitectura-inicial.md`. Si este archivo contradice a esas fuentes, gana la fuente; corregir aquí.

**Estado del proyecto:** desarrollo en curso, ticket por ticket. Implementados: TK-00 (scaffold), TK-01 (Storage Layer), TK-02a (base compartida: `StepResult`, configuración, resolutor de tipo de issue, regla de lint), TK-02b (cliente REST de Jira) y TK-02c (Git Manager). Todo lo demás es comportamiento *especificado*, aún sin código; los pasos que ya tienen parte implementada llevan la etiqueta `🚧 En desarrollo`.

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

### 1.2 Primer arranque en frío — `🚧 En desarrollo` · TK-01, TK-02a (`SQLiteStorageManager` y `AppConfigProvider` implementados; falta el Orquestador que los instancia)

- `getAppConfig()` devuelve `null` sin lanzar excepción (TK-01 CA6).
- `SQLiteStorageManager` aplica las migraciones de forma idempotente (TK-01 CA7) y crea `devflow.db` en modo **WAL** con las 4 tablas: `app_config`, `jira_projects`, `repositories`, `ticket_logs`.
- La configuración se resuelve **una sola vez** al arrancar y el Orquestador la inyecta por constructor a Jira, Ollama, Git y FileSystem. Ningún componente de integración lee SQLite.

### 1.3 `devflow config` — sufijo de usuario y credenciales — `📄 Especificado` · US-01 CA4 · TK-03a

1. El usuario carga `jira_base_url`, email y API Token en `app_config`.
2. El Orquestador llama a `GET /myself`, toma el `displayName` y propone el sufijo: inicial del nombre + último apellido, sin acentos y en mayúsculas (p. ej. `AROCHA`).
3. El usuario confirma o edita; se guarda como `branch_user_suffix`.

> Los nombres de los comandos `devflow config` y `devflow config proyectos` están decididos (hueco **H-06**, resuelto). El token se guarda en claro en `app_config` en el MVP (H-05, decidido; ver `002` §2.5).

### 1.4 `devflow config proyectos` — claves y repositorios — `🚧 En desarrollo` · US-01 CA1-3, CA5-6 · TK-02/TK-03a (`validateProjectKey` implementado en TK-02b; faltan Git, Orquestador y TUI)

- **Alta de clave:** se valida con `GET /rest/api/2/project/{key}` (la JQL ignora sin error las claves inexistentes). Ante un 404 se llama a `/myself`: **401 = token inválido**, **200 = la clave no existe**. Se guarda con el nombre del proyecto.
- **Alta de repositorio** (0..N por clave): nombre (`backend`), ruta local y rama base (por defecto `main`). `GitManager.validateRepository` comprueba que sea un repo Git con remoto `origin` y que la rama base exista en el remoto.
- **Edición:** *upsert* por `jira_project_key` y por `(jira_project_id, name)`; no quedan duplicados (TK-01 CA2). Borrar una clave borra en cascada sus repositorios (TK-01 CA3).
- **Guarda:** sin ninguna clave configurada, `devflow start` indica que hay que dar de alta al menos una (US-01 CA6).

**Resiliencia:** clave inválida, ruta que no es repo Git o rama base inexistente → se rechaza el alta con el motivo. No queda estado parcial.

---

## 2. 📋 Selección y consulta del ticket

**Historias:** US-02 · **Tickets:** TK-02 (Jira/Orquestador), TK-03 (prompts)

### 2.1 Entrada — `devflow start [ID] [--base rama] [--reprocesar]` — `📄 Especificado` · TK-03b

- **Sin ID:** la TUI llama a `TicketOrchestrator.listAssignedTickets()`. El cliente Jira ejecuta
  `project in (…) AND assignee = currentUser() AND statusCategory != Done AND issuetype != Epic ORDER BY updated DESC` y el usuario elige uno (US-02 CA1).
- **Con ID:** la TUI valida el formato `^[A-Z][A-Z0-9_]+-\d+$` antes de invocar al Orquestador; si es inválido, muestra el error sin llamar a nada (TK-03 CA1).

### 2.2 Validación de clave y selección de repositorio — `📄 Especificado` · US-02 CA3 · TK-02/TK-03b

- `listRepositoriesForTicket(ID)` deriva la clave del ID. Si la clave **no está configurada**, falla **antes de llamar a Jira** y muestra las claves disponibles.
- Si la clave tiene varios repositorios, el usuario elige uno; con uno solo se preselecciona; sin repositorios no hay selección y no se pasa `repositoryId` (TK-03 CA4).
- **Un repositorio por ejecución.** Un ticket que toca varios se ejecuta una vez por repositorio, en secuencia.

### 2.3 Consulta a Jira — `✅ Implementado y probado` · US-02 CA2 · TK-02b (cliente; falta integrarlo en el Orquestador, TK-02f)

- `GET /rest/api/2/issue/{id}?fields=summary,description,issuetype`, con Basic email + token.
- La `description` llega en texto plano y se mapea de forma determinista a `ContextoTicket` (sin LLM).
- Un reintento con backoff corto (~2 s) ante timeout. Un cuerpo 2xx con campos de tipo incorrecto, una URL base inválida o una clave de proyecto con formato inválido (en `listAssignedTickets`) dan `ErrorBloqueante('ErrorInesperado')`, nunca una excepción.

### 2.4 Fallback manual — `🚧 En desarrollo` · US-02 CA4-5 · TK-02b, TK-02f/TK-03b (la clasificación de fallos del cliente Jira está implementada; faltan `ask()` y el prompt de la TUI)

| Causa | Detección | Resultado |
|---|---|---|
| Red caída | Timeout persistente tras 1 reintento | `FallbackManual('network_timeout')` |
| Token inválido | 401/403, o 404 + `/myself` 401 | `FallbackManual('invalid_token')` |
| Ticket inexistente | 404 + `/myself` 200 | `FallbackManual('not_found')` |
| Límite de peticiones | 429 | Se respeta `Retry-After` antes de fallar |

El Orquestador invoca `ask({ kind: 'manualTicket', reason })`; la TUI abre `ManualTicketEntryPrompt` con el motivo, el usuario ingresa título y descripción y el flujo continúa con `source: 'manual'` y `jira_fetch_status = 'fallback_manual'`.

### 2.5 Resolución del tipo de issue — `✅ Implementado y probado` · US-02 CA6 · TK-02a (`resolveIssueType`; el Orquestador aún no lo invoca)

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
   - luego `git pull --no-rebase --ff-only origin <base>`. Si el pull falla, el repositorio queda parado en la base.
   Si falla (sin red, historial divergente, credenciales) → `ErrorBloqueante('PullFallido')`, `branch_status = 'error'`. **Nunca** se ramifica desde una base desactualizada.
5. **Crea la rama:** `git switch -c <rama> <base>`. `--base` aplica solo a esta ejecución y no cambia la configuración del repositorio.

**Garantía:** nunca `commit`, `add` ni `push`; ningún archivo versionado se modifica.

### 3.2 FileSystem Manager — carpetas — `📄 Especificado` · ADR-004.1 · TK-02

- Crea `<raíz de tickets>\ID\<repositorio>\adjuntos\` **fuera del repositorio Git** (clave sin repos: solo el documento, sin subcarpeta de repositorio).
- Falta de permisos (antivirus, OneDrive, ruta bloqueada) → `ErrorBloqueante('PermisosInsuficientes')`: se detiene ese paso y se reporta qué se alcanzó a completar.

---

## 4. 🤖 Generación asistida por IA y documento de Fase 1

**Historias:** US-03 · **Tickets:** TK-02

### 4.1 Reutilización y reproceso de Fase 1 — `📄 Especificado` · US-03 CA6, CA9 · TK-02

- Si existe `ID\.devflow\fase1.json` (el ticket ya se ejecutó con otro repositorio) → se reutiliza, `ollama_status = 'reused'`, **no se invoca a Ollama**.
- Si es la primera ejecución del ticket → 4.2.
- Si el `fase1.json` existente fue generado en **fallback** (`generatedByOllama: false`), no se reutiliza: se reintenta con Ollama (4.2) automáticamente.
- Con **`--reprocesar`** (H-02) se ignora el `fase1.json` y se vuelve a invocar a Ollama (4.2). Si el nuevo intento es válido, sobrescribe `fase1.json` y reemplaza solo el bloque de Fase 1 del documento del repositorio elegido; si cae en fallback, **se conserva la Fase 1 válida anterior**. Los documentos de otros repositorios del ticket no se tocan.

### 4.2 Ollama AI Transformer — `📄 Especificado` · ADR-003.1 · TK-02

- Prompt armado con archivos versionados de `templates/prompts/` (`comun.system.md`, `<tipo>.system.md`, `ticket.user.md`).
- `POST /api/generate` con *streaming* y el JSON Schema del tipo en `format`; la TUI muestra el progreso. Modelo `qwen2.5:3b`, `ollama_timeout_seconds` = 120, `keep_alive` corto.
- El primer campo del schema es `presenteEnTicket`: el modelo clasifica qué datos existen antes de redactar.

### 4.3 Validación y posprocesado — `📄 Especificado` · TK-02 CA2

- Validación con **Ajv** contra el mismo schema (fuente de verdad).
- Posprocesado determinista: `siFalta` sobrescribe los datos ausentes con *"No especificado en el ticket."* y agrega la pregunta abierta; `verificarLiterales` descarta números o textos entre comillas que no estén en el ticket.
- Contenido por tipo — **historia:** `historiaUsuario{como,quiero,para}`, `casosDeUso[]`, `escenarios[]` Gherkin, `preguntasAbiertas[]`. **Bug:** `pasosParaReproducir[]`, `comportamientoEsperado`, `comportamientoActual`, `entorno`, escenarios y preguntas.
- Cualquier bloque de código embebido invalida la respuesta (Non-Goal "cero código generado").

### 4.4 Fallback determinista — `📄 Especificado` · US-03 CA4 · TK-02

- Se activa ante: Ollama caído, modelo no instalado, timeout de 120 s, JSON mal formado o con campos faltantes, o código embebido.
- Resultado: `FallbackDeterminista(rawText)` → el texto crudo de Jira va en las secciones de Fase 1, marcado `⚠️ Generado sin Ollama — completar manualmente`.
- La rama y las carpetas **ya fueron creadas**: el flujo no se bloquea.

### 4.5 Renderizado del documento — `📄 Especificado` · TK-02 CA4

- `FileSystemManager.writeDocument` combina la Fase 1 con la plantilla de Fase 2 del tipo (Handlebars: `bug.md.hbs` / `historia.md.hbs`).
- La Fase 1 queda delimitada por `<!-- DEVFLOW:FASE1:INICIO -->` / `<!-- DEVFLOW:FASE1:FIN -->`.
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

### 5.2 Resumen en la TUI — `📄 Especificado` · TK-03b CA6-7

- Éxito: rama, carpeta y documento — "Ticket ID listo para trabajar".
- Avisos distinguibles: `⚠️ Generado sin Ollama`; "análisis reutilizado" (`reused`); pantallas de bloqueo (cambios pendientes con archivos, pull fallido, épica, repositorio no encontrado). Un resumen con `blocked` **nunca** muestra pantalla de éxito.

### 5.3 Fase 2 manual (fuera de la herramienta) — `📄 Especificado` · PRD §3

El desarrollador abre el documento en su IDE y completa: **Objetos Modificados**, **Evidencias de Pruebas** (enlaces a `adjuntos/`) e **Instrucciones de Pasaje a Producción**. Cualquier bloque de código lo ingresa él, nunca el LLM. QA y DevOps encuentran la misma estructura y ubicación en todos los tickets del mismo tipo.

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
| **H-06** | **Comandos de configuración *asumidos*.** `devflow config` / `devflow config proyectos` son una propuesta de TK-03; ningún documento base define cómo se ejecuta US-01. Pendiente de validar con el equipo (DoD de TK-03). | **TK-03** (`config.command.ts`) y **US-01** (agregar el comando a los criterios). | 🟢 Resuelto (2026-11-02): se mantienen `devflow config` (token, sufijo, datos de Jira) y `devflow config proyectos` (claves y repositorios). Los flags y subcomandos concretos se fijan al refinar TK-03a. |

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
