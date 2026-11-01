# 009. Flujo funcional de DevFlow CLI

> **Documento vivo.** Describe, paso a paso, cómo se comporta DevFlow CLI desde la instalación inicial hasta que el desarrollador completa la documentación de un ticket. Se actualiza a medida que se implementa el código.
>
> Fuentes de verdad: `docs/PRD.md`, `docs/001-descripcion-general-del-producto.md`, `docs/002-arquitectura-del-sistema.md`, `docs/005-historias-de-usuario.md`, `docs/006-tickets-de-trabajo.md`, `docs/ADR-001-arquitectura-inicial.md`. Si este archivo contradice a esas fuentes, gana la fuente; corregir aquí.

**Estado del proyecto:** fase de documentación — **no existe código todavía**. Todo lo descrito abajo es comportamiento *especificado*, no implementado.

## Cómo mantener este documento

- Cada paso lleva su referencia a historia (`US-XX`) y ticket (`TK-XX`).
- La columna/etiqueta **Estado** de cada paso usa: `📄 Especificado` (solo documentación) · `🚧 En desarrollo` · `✅ Implementado y probado`. Al implementar un paso, cambiar su estado y anotar el commit/PR en el [Registro de cambios](#registro-de-cambios).
- Los **huecos abiertos** (§7) se resuelven actualizando la fuente (US/TK/PRD/ADR) **y** este archivo; luego se marcan como resueltos, no se borran.
- Si una decisión cambia el flujo, actualizar también `README.md` y `docs/001-*.md` / `docs/002-*.md` (ver `CLAUDE.md`).

---

## 0. Resumen del flujo

```text
Etapa 1: Instalación y configuración (devflow config / config proyectos)      US-01 · TK-01 · TK-03
Etapa 2: Selección y consulta del ticket (devflow start [ID])                  US-02 · TK-02 · TK-03
Etapa 3: Preparación del entorno (Git + carpetas)                              US-03 · TK-02
Etapa 4: Generación asistida (Ollama → Fase 1 → documento)                     US-03 · TK-02
Etapa 5: Fase 2 manual + registro en SQLite                                    TK-01 · TK-02
```

Contrato de resultado de cada paso orquestado: `Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante`. Ninguna falla de una integración llega a la TUI como excepción cruda.

---

## 1. ⚙️ Instalación y configuración inicial

**Historias:** US-01 · **Tickets:** TK-01 (storage), TK-02 (validaciones), TK-03 (comandos)

### 1.1 Requisitos del entorno — `📄 Especificado`

Ref.: `002` §2.2.1.

- Node.js ≥ 22.13 (la herramienta comprueba la versión al arrancar).
- Git en el `PATH`, con acceso al remoto `origin` de cada repositorio.
- Ollama activo en `ollama_host` (por defecto `http://localhost:11434`) con `qwen2.5:3b` como mínimo.
- Email de Jira + API Token clásico (un token *with scopes* no funciona contra `*.atlassian.net`).
- Permisos de escritura en `%APPDATA%\DevFlowCLI\` (base SQLite) y en la raíz de tickets (`%USERPROFILE%\DevFlowCLI\tickets\`).

> Procedimiento de instalación concreto: ver hueco **H-05**.

### 1.2 Primer arranque en frío — `📄 Especificado` · TK-01

- `getAppConfig()` devuelve `null` sin lanzar excepción (TK-01 CA6).
- `SQLiteStorageManager` aplica las migraciones de forma idempotente (TK-01 CA7) y crea `devflow.db` en modo **WAL** con las 4 tablas: `app_config`, `jira_projects`, `repositories`, `ticket_logs`.
- La configuración se resuelve **una sola vez** al arrancar y el Orquestador la inyecta por constructor a Jira, Ollama, Git y FileSystem. Ningún componente de integración lee SQLite.

### 1.3 `devflow config` — sufijo de usuario y credenciales — `📄 Especificado` · US-01 CA4 · TK-03

1. El usuario carga `jira_base_url`, email y API Token en `app_config`.
2. El Orquestador llama a `GET /myself`, toma el `displayName` y propone el sufijo: inicial del nombre + último apellido, sin acentos y en mayúsculas (p. ej. `AROCHA`).
3. El usuario confirma o edita; se guarda como `branch_user_suffix`.

> El nombre del comando `devflow config` es *asumido* (ver hueco **H-06**). Almacenamiento del token: hueco **H-05**.

### 1.4 `devflow config proyectos` — claves y repositorios — `📄 Especificado` · US-01 CA1-3, CA5-6 · TK-02/TK-03

- **Alta de clave:** se valida con `GET /rest/api/2/project/{key}` (la JQL ignora sin error las claves inexistentes). Ante un 404 se llama a `/myself`: **401 = token inválido**, **200 = la clave no existe**. Se guarda con el nombre del proyecto.
- **Alta de repositorio** (0..N por clave): nombre (`backend`), ruta local y rama base (por defecto `main`). `GitManager.validateRepository` comprueba que sea un repo Git con remoto `origin` y que la rama base exista en el remoto.
- **Edición:** *upsert* por `jira_project_key` y por `(jira_project_id, name)`; no quedan duplicados (TK-01 CA2). Borrar una clave borra en cascada sus repositorios (TK-01 CA3).
- **Guarda:** sin ninguna clave configurada, `devflow start` indica que hay que dar de alta al menos una (US-01 CA6).

**Resiliencia:** clave inválida, ruta que no es repo Git o rama base inexistente → se rechaza el alta con el motivo. No queda estado parcial.

---

## 2. 📋 Selección y consulta del ticket

**Historias:** US-02 · **Tickets:** TK-02 (Jira/Orquestador), TK-03 (prompts)

### 2.1 Entrada — `devflow start [ID] [--base rama]` — `📄 Especificado` · TK-03

- **Sin ID:** la TUI llama a `TicketOrchestrator.listAssignedTickets()`. El cliente Jira ejecuta
  `project in (…) AND assignee = currentUser() AND statusCategory != Done AND issuetype != Epic ORDER BY updated DESC` y el usuario elige uno (US-02 CA1).
- **Con ID:** la TUI valida el formato `^[A-Z][A-Z0-9_]+-\d+$` antes de invocar al Orquestador; si es inválido, muestra el error sin llamar a nada (TK-03 CA1).

### 2.2 Validación de clave y selección de repositorio — `📄 Especificado` · US-02 CA3 · TK-02/TK-03

- `listRepositoriesForTicket(ID)` deriva la clave del ID. Si la clave **no está configurada**, falla **antes de llamar a Jira** y muestra las claves disponibles.
- Si la clave tiene varios repositorios, el usuario elige uno; con uno solo se preselecciona; sin repositorios no hay selección y no se pasa `repositoryId` (TK-03 CA4).
- **Un repositorio por ejecución.** Un ticket que toca varios se ejecuta una vez por repositorio, en secuencia.

### 2.3 Consulta a Jira — `📄 Especificado` · US-02 CA2 · TK-02

- `GET /rest/api/2/issue/{id}?fields=summary,description,issuetype`, con Basic email + token.
- La `description` llega en texto plano y se mapea de forma determinista a `ContextoTicket` (sin LLM).
- Un reintento con backoff corto (~2 s) ante timeout.

### 2.4 Fallback manual — `📄 Especificado` · US-02 CA4-5 · TK-02/TK-03

| Causa | Detección | Resultado |
|---|---|---|
| Red caída | Timeout persistente tras 1 reintento | `FallbackManual('network_timeout')` |
| Token inválido | 401/403, o 404 + `/myself` 401 | `FallbackManual('invalid_token')` |
| Ticket inexistente | 404 + `/myself` 200 | `FallbackManual('not_found')` |
| Límite de peticiones | 429 | Se respeta `Retry-After` antes de fallar |

El Orquestador invoca `ask({ kind: 'manualTicket', reason })`; la TUI abre `ManualTicketEntryPrompt` con el motivo, el usuario ingresa título y descripción y el flujo continúa con `source: 'manual'` y `jira_fetch_status = 'fallback_manual'`.

### 2.5 Resolución del tipo de issue — `📄 Especificado` · US-02 CA6 · TK-02

Según `templates/issue-types.json`:

- **Épica / Epic** → `ErrorBloqueante('TipoIssueBloqueado')`: aviso de que no tiene plantilla; **sin** rama, carpeta, documento ni registro en `ticket_logs`.
- **Bug / Error / Defecto** → plantilla `bug`, prefijo de rama `bugs/`.
- **Resto** (historia, tarea, subtarea…) → plantilla `historia`, prefijo `features/`.

---

## 3. 🛠️ Preparación automática del entorno

**Historias:** US-03 · **Tickets:** TK-02

Cada paso emite `onStep(paso, estado)` hacia la TUI para el spinner. Si la clave **no tiene repositorios**, el paso Git se omite y solo se genera el documento (US-03 CA7).

### 3.1 Git Manager (ADR-007.1) — `📄 Especificado` · US-03 CA1-3, CA5, CA8 · TK-02

Rama: `<prefijo>/<ID>-<SUFIJO>` (p. ej. `features/SCRUM-1-AROCHA`).

1. **Verifica el repositorio.** Si no existe → `ErrorBloqueante('RepositorioNoEncontrado')`.
2. **`git status --porcelain`.** Con cambios pendientes (modificados, staged o sin trackear) → `ErrorBloqueante('CambiosPendientes')` con la lista de archivos; se registra `branch_status = 'pending_changes'` y se corta **antes de crear nada**. No hay `stash` automático.
3. **Si la rama ya existe** → `Ok(alreadyExisted)`; informa y continúa con carpeta y documento, sin pull ni creación.
4. **Actualiza la rama base** sin importar la rama actual:
   - parado en la base: `git pull --ff-only origin <base>`;
   - parado en otra rama: `git fetch origin <base>:<base>`.
   Si falla (sin red, historial divergente, credenciales) → `ErrorBloqueante('PullFallido')`, `branch_status = 'error'`. **Nunca** se ramifica desde una base desactualizada.
5. **Crea la rama:** `git switch -c <rama> <base>`. `--base` aplica solo a esta ejecución y no cambia la configuración del repositorio.

**Garantía:** nunca `commit`, `add` ni `push`; ningún archivo versionado se modifica.

### 3.2 FileSystem Manager — carpetas — `📄 Especificado` · ADR-004.1 · TK-02

- Crea `<raíz de tickets>\ID\<repositorio>\adjuntos\` **fuera del repositorio Git** (clave sin repos: solo el documento, sin subcarpeta de repositorio).
- Falta de permisos (antivirus, OneDrive, ruta bloqueada) → `ErrorBloqueante('PermisosInsuficientes')`: se detiene ese paso y se reporta qué se alcanzó a completar.

---

## 4. 🤖 Generación asistida por IA y documento de Fase 1

**Historias:** US-03 · **Tickets:** TK-02

### 4.1 Reutilización de Fase 1 — `📄 Especificado` · US-03 CA6 · TK-02

- Si existe `ID\.devflow\fase1.json` (el ticket ya se ejecutó con otro repositorio) → se reutiliza, `ollama_status = 'reused'`, **no se invoca a Ollama**.
- Si es la primera ejecución del ticket → 4.2.

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

### 5.2 Resumen en la TUI — `📄 Especificado` · TK-03 CA6-7

- Éxito: rama, carpeta y documento — "Ticket ID listo para trabajar".
- Avisos distinguibles: `⚠️ Generado sin Ollama`; "análisis reutilizado" (`reused`); pantallas de bloqueo (cambios pendientes con archivos, pull fallido, épica, repositorio no encontrado). Un resumen con `blocked` **nunca** muestra pantalla de éxito.

### 5.3 Fase 2 manual (fuera de la herramienta) — `📄 Especificado` · PRD §3

El desarrollador abre el documento en su IDE y completa: **Objetos Modificados**, **Evidencias de Pruebas** (enlaces a `adjuntos/`) e **Instrucciones de Pasaje a Producción**. Cualquier bloque de código lo ingresa él, nunca el LLM. QA y DevOps encuentran la misma estructura y ubicación en todos los tickets del mismo tipo.

### 5.4 Reejecución e idempotencia — `📄 Especificado` · TK-02 CA4

- Reprocesar un ticket regenera **solo** el bloque entre los marcadores de Fase 1; el contenido de Fase 2 ya escrito se preserva intacto.
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
| Rama ya existente | Git | `Ok(alreadyExisted)` | ✅ sin pull ni creación | US-03 CA5 · TK-02 |
| Ollama caído / timeout / JSON inválido / con código | Ollama | `FallbackDeterminista` | ✅ documento con `⚠️` | US-03 CA4 · TK-02 |
| Sin permisos de disco | FileSystem | `ErrorBloqueante` | ❌ reporta lo completado | TK-02 |

---

## 7. Huecos abiertos

Detectados al cruzar las fuentes (análisis pre-código, 2026-11-01). Cada uno indica **dónde resolverlo**. Al cerrarlo: actualizar la fuente, este archivo, y pasar el estado a ✅ con fecha y referencia.

| ID | Hueco | Dónde resolverlo | Estado |
|---|---|---|---|
| **H-01** | **Las métricas se registran antes de la Fase 2.** `ticket_logs` se escribe al cerrar la Fase 1; ningún evento registra cuándo el desarrollador completa la Fase 2, por lo que la herramienta no puede medir "documentación completada". Decidir: fuera del MVP, o un comando/estado de cierre (¿nueva columna en `ticket_logs`?). | **TK-01** (esquema `ticket_logs`, `003-modelo-de-datos.md`) y **TK-02** (Orquestador). Posible nueva US si se incorpora. | 🔴 Abierto |
| **H-02** | **No hay mecanismo para pedir el reproceso de la Fase 1.** `002` §2.2 dice que se regenera "si el usuario lo pide" o si la primera vez cayó en fallback, pero ni TK-02 ni TK-03 definen flag o prompt (`--reprocesar`, confirmación…). Tampoco qué pasa con `fase1.json` previo. | **TK-03** (comando/flags de `start`) y **TK-02** (`writeDocument` con `regenerateFase1Only`, `FileSystemManager.saveFase1`). Revisar **US-03** (falta un criterio de reproceso). | 🔴 Abierto |
| **H-03** | **`ConfirmActionsPrompt` no está en el diagrama de secuencia.** TK-03 define una confirmación única antes de actuar (*ambiguo*), pero el diagrama E2E de `002` §2.1 no la incluye, ni dice si se puede cancelar. | **TK-03** (contrato `ConfirmActionsPrompt`) y diagrama Mermaid de `002` §2.1 (actualizar ambos juntos). | 🔴 Abierto |
| **H-04** | **Rama ya existente: sin acción adicional.** US-03 CA5 queda *ambiguo*: solo informa y continúa. No se define qué pasa con el checkout (¿queda en la rama actual?), ni si se ofrece cambiar a esa rama. | **US-03 CA5** y **TK-02** (`GitManager.createBranch`, CA3). | 🔴 Abierto |
| **H-05** | **Instalación y manejo del token sin definir.** `001` §1.4 y README §1.4 están `[A definir]`; tampoco se decide si el API Token se guarda en claro o cifrado (DPAPI) ni su rotación (`002` §2.5). | **TK-01** (columna `jira_api_token` de `app_config`), **`001` §1.4 / README §1.4**, **`002` §2.5**. Posible ADR nuevo. | 🔴 Abierto |
| **H-06** | **Comandos de configuración *asumidos*.** `devflow config` / `devflow config proyectos` son una propuesta de TK-03; ningún documento base define cómo se ejecuta US-01. Pendiente de validar con el equipo (DoD de TK-03). | **TK-03** (`config.command.ts`) y **US-01** (agregar el comando a los criterios). | 🔴 Abierto |

---

## Registro de cambios

| Fecha | Cambio | Ref. |
|---|---|---|
| 2026-11-01 | Creación del documento a partir del análisis del flujo pre-código (fuentes: 001, 002, 005, 006, PRD, README). Se registran H-01 a H-06. | — |
