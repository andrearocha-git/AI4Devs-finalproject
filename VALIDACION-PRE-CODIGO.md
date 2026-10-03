# Validación pre-código — DevFlow CLI

> Registro de la sesión del 2026-10-02: estado del proyecto, planificación para arrancar el código, validación real de las integraciones con Jira y Ollama, y primera versión de prompts y plantillas. Las decisiones de este documento **todavía no están reflejadas** en `docs/` (PRD, ADR, 002, 003, tickets); la sección 7 lista qué hay que actualizar.

## Índice

1. [Estado del proyecto](#1-estado-del-proyecto)
2. [Planificación para arrancar el código](#2-planificación-para-arrancar-el-código)
3. [Validación de Jira](#3-validación-de-jira)
4. [Validación de Ollama](#4-validación-de-ollama)
5. [Prompts para Ollama: dónde viven](#5-prompts-para-ollama-dónde-viven)
6. [Prompts y plantillas por tipo de issue](#6-prompts-y-plantillas-por-tipo-de-issue)
7. [Pendientes y cambios a volcar en `docs/`](#7-pendientes-y-cambios-a-volcar-en-docs)
8. [Proyectos de Jira, repositorios y ramas](#8-proyectos-de-jira-repositorios-y-ramas)

---

## 1. Estado del proyecto

**Fase de especificación cerrada, sin código de aplicación** (salvo las plantillas de la sección 6).

- Rama `feature/entrega-1-ANR` (= `rama-prueba`): 6 commits por delante de `main`, sin mergear localmente.
- Hecho: PRD, ADR-001 (arquitectura en 3 capas, SQLite, Ollama con fallback, evidencias fuera del repo, Jira REST directo, Git Manager mínimo), docs `001`–`007`, ADR-006.1 de stack (`docs/008`, estado **Propuesto**: Node.js/TypeScript), `prompts.md`, README §0 y resúmenes de §1–§7.
- Falta: cerrar ADR-006.1, crear el proyecto en `finalproject-ANR/`, implementar TK-01…TK-03, y completar en el README §1.3 (UX), §1.4 (instalación), §2.4 (infraestructura), §2.6 (tests) y PR 2/PR 3 de §7.

---

## 2. Planificación para arrancar el código

### 2.1. Decisiones abiertas (con recomendación)

| # | Decisión | Recomendación | Estado |
|---|---|---|---|
| 1 | Jira Cloud o Data Center; API v2 o v3 | Cloud, API **v2**, auth Basic email + token | ✅ Resuelta (§3) |
| 2 | Carpeta raíz de tickets (US-01) sin columna en `app_config` | Añadir `tickets_root_path`, default `%USERPROFILE%\DevFlowCLI\tickets` | Pendiente |
| 3 | `UNIQUE(ticket_id, project_config_id)` en `ticket_logs` rompe la reejecución | `appendTicketLog` pasa a *upsert* | Pendiente |
| 4 | Nombre de rama `feature\|bugfix/ID-resumen` | ~~*slug* del título~~ → **`features/SCRUM-1-AROCHA`, `bugs/SCRUM-2-AROCHA`**: prefijo según el tipo de issue + ID + sufijo de usuario, sin resumen | ✅ Resuelta (§8) |
| 5 | Rama base | **Desde la rama base configurada por el usuario para cada repo (por defecto `main`), actualizada con pull**, sin importar en qué rama esté el desarrollador. Antes, `git status`: si hay cambios pendientes, no se continúa | ✅ Resuelta (§8) |
| 6 | Token de Jira en texto plano en SQLite | Aceptar para el MVP (el Credential Manager añade dependencia nativa) | Pendiente |
| 7 | Ink sí/no | Empezar sin Ink: `@inquirer/prompts` + spinner ligero | Pendiente |
| 8 | Driver SQLite | `node:sqlite` (sin compilación nativa, exige Node ≥ 22.13) | Pendiente |
| 9 | Ambiguos de US-01/02/03 | Validar rutas al configurar; 404 → ofrecer carga manual; rama existente → informar y continuar | Pendiente |
| 10 | Umbral de cobertura | 80 % en la Service Layer | Pendiente |

### 2.2. Información pendiente

- Versión de Node en los 5 puestos del equipo (ADR-006.1 lo exige antes de TK-01). En el WSL de desarrollo: Node v24.19.
- Acceso a una máquina Windows real para validar (Windows Terminal, `%APPDATA%`).
- Fecha de la Entrega 2 y lo que exige el curso.
- Confirmar si la Entrega 1 ya se mergeó a `main` en GitHub.

### 2.3. Fases

Rama `feature/entrega-2-ANR`; código en `finalproject-ANR/` (no `devflow-cli/` como dice el árbol de `002` §2.3).

| Fase | Contenido | PR |
|---|---|---|
| 0 | Cerrar decisiones en docs: ADR-006.1 → Aceptado, DDL de `003`, `002`, TK-01/02/03, README | — |
| 1 | Andamiaje: `package.json` (`engines`, `bin: devflow`), TS `strict`, Vitest, ESLint con regla de imports por capa, tipos compartidos (`StepResult<T>`, `ContextoTicket`, `AppConfig`), chequeo de versión de Node | — |
| 2 | TK-01 Storage: DDL, migraciones idempotentes, WAL, `SQLiteStorageManager`, `LocalFileStorage`, tests con `:memory:` | PR 2 |
| 3 | TK-02 Servicios (TDD, de menor a mayor riesgo): Jira → Git → FileSystem + plantilla → Ollama → Orquestador | PR 3 |
| 4 | TK-03 TUI: Commander (`start`, `config`), prompts, vistas de progreso/resumen/fallback | PR 4 o junto a PR 3 |
| 5 | Validación E2E real, prueba en Windows, medición de RAM, documentación del README | — |

---

## 3. Validación de Jira

**Resultado: acceso validado.** Jira Cloud con token clásico de id.atlassian.com.

### 3.1. Configuración usada

Credenciales en `~/.config/devflow/jira.env` (fuera del repo, `chmod 600`):

```bash
JIRA_BASE_URL=https://<sitio>.atlassian.net
JIRA_EMAIL=<email de la cuenta Atlassian>
JIRA_API_TOKEN=<token>
```

Prueba manual:

```bash
set -a; . ~/.config/devflow/jira.env; set +a
curl -sS -w "\nHTTP %{http_code}\n" -u "$JIRA_EMAIL:$JIRA_API_TOKEN" -H "Accept: application/json" \
  "$JIRA_BASE_URL/rest/api/2/myself"
```

> Si el token es de tipo *with scopes*, no funciona contra `*.atlassian.net`: hay que usar `https://api.atlassian.com/ex/jira/<cloudId>` y el scope `read:jira-work`.

### 3.2. Resultados

| Prueba | Resultado |
|---|---|
| `GET /rest/api/2/myself` | **200** — cuenta activa |
| Proyectos visibles | `MPDD`, `SCRUM`, `SUP`, `TC` |
| `GET /rest/api/2/search/jql` y `/issue/{id}` | **200** — p. ej. `SCRUM-1` "Configuracion Jira" (Historia) |
| Formato de `description` en API v2 | **Texto plano** (string), no ADF → no hace falta convertir |

### 3.3. Hallazgo: con token inválido Jira Cloud devuelve 404, no 401

| Caso | Respuesta |
|---|---|
| Ticket inexistente (`SCRUM-99999`) | 404 |
| **Token inválido en `/issue/{id}`** | **404** |
| Sin credenciales en `/issue/{id}` | 404 |
| Token inválido en `/myself` | 401 |

Jira Cloud no revela si un ticket existe cuando la autenticación falla. Con el diseño actual de TK-02, un token caducado se mostraría como "ticket no encontrado".

**Regla propuesta para el Jira REST Client:** ante un 404 en `/issue`, llamar a `/myself`. Si devuelve 401 → `FallbackManual('invalid_token')`; si devuelve 200 → `FallbackManual('not_found')`.

### 3.4. Consecuencias para el diseño

- `app_config` necesita una columna **`jira_email`** (auth Basic `email:token`).
- Endpoints a usar: `/rest/api/2/issue/{id}?fields=summary,description,issuetype` y `/rest/api/2/myself`.

---

## 4. Validación de Ollama

Entorno de prueba: WSL, 15 GB RAM, **solo CPU** (sin GPU), Ollama 0.32.6. Llamada a `/api/generate` con `stream: false`, `keep_alive` corto y el schema JSON en el parámetro `format` (salida estructurada).

### 4.1. Comparación de modelos (mismo prompt y schema)

| | `qwen2.5:1.5b` | **`qwen2.5:3b`** |
|---|---|---|
| RAM cargado | ~1,2 GB | ~2,2 GB |
| Tiempo por ticket | 8–26 s | 41–45 s (prompt corto) · 30–105 s (prompt final de §6) |
| JSON válido | ✅ | ✅ |
| Fidelidad al ticket | ❌ inventa contenido y se sale de tema | ✅ respeta los criterios de aceptación del ticket |
| Gherkin | ❌ escenarios duplicados e incoherentes | ✅ coherente |

### 4.2. Conclusiones

1. **La salida estructurada es fiable**: con `format: <schema>` el JSON sale válido siempre. La validación de ADR-003.1 queda como red de seguridad.
2. **Modelo mínimo viable: `qwen2.5:3b`.** El 1.5b queda descartado por calidad.
3. **El schema funciona mejor con listas** (`casosDeUso: string[]`, `escenarios: {titulo, given, when, then}[]`) y con el Markdown armado por código.
4. **El timeout de 15 s del DDL es inviable.** Subir `ollama_timeout_seconds` a ~120 s.
5. **El tiempo es el riesgo principal del producto**: 30–105 s en una máquina de 15 GB sin carga; en los PCs del equipo (8 GB con IDEs abiertos) será peor. Hace falta streaming en la TUI para dar feedback, limitar la salida y repetir la medición en un puesto real (condición 4 de ADR-006.1).
6. `keep_alive` corto libera la memoria tras cada uso, como pide ADR-006.1.

---

## 5. Prompts para Ollama: dónde viven

**Decisión: archivos versionados dentro de la aplicación** (`finalproject-ANR/templates/prompts/`), no strings en el código TypeScript ni registros en SQLite.

- Frente al código: el prompt es lo que más se itera, y en `.md` se lee, se revisa en un PR y se compara mejor.
- Frente a SQLite/configuración del usuario: el PRD exige un documento uniforme para QA y deja fuera las reglas configurables en el MVP.
- Prompt y schema se versionan juntos para que no se desincronicen.
- **`prompt_version`** se registra en `ticket_logs` para poder medir la "tasa de éxito sin fallback" por versión.
- Fuera del MVP: que el usuario sobrescriba el prompt con su propio archivo.

---

## 6. Prompts y plantillas por tipo de issue

### 6.1. Archivos creados

```
finalproject-ANR/
├── templates/
│   ├── README.md                  # contrato de las piezas, para implementar el transformer
│   ├── issue-types.json           # tipo de Jira → plantilla, prefijo de rama y reglas de datos ausentes
│   ├── prompts/
│   │   ├── comun.system.md        # reglas comunes contra las alucinaciones
│   │   ├── bug.system.md          # pasos, esperado/actual, entorno + ejemplo
│   │   ├── historia.system.md     # como/quiero/para, casos de uso + ejemplo
│   │   ├── ticket.user.md         # datos del ticket (Handlebars)
│   │   ├── bug.schema.json        # schema para `format` de Ollama y para validar
│   │   └── historia.schema.json
│   └── documents/
│       ├── bug.md.hbs             # Fase 1 + Fase 2: causa raíz, solución, antes/después, regresión, pasaje
│       └── historia.md.hbs        # Fase 1 + Fase 2: objetos modificados, evidencias, pasaje
└── tests/fixtures/tickets/        # formato de respuesta de Jira v2
    ├── bug-completo.json          # con pasos, esperado, actual, entorno
    ├── bug-escueto.json           # "No anda el login"
    ├── historia-completa.json     # en inglés, con 4 criterios de aceptación
    └── historia-escueta.json      # SCRUM-1 real
```

Mapeo de tipos (`issue-types.json`): `Bug`/`Error`/`Defecto` → plantilla **bug**, rama `bugfix`. `Story`/`Historia`/`Task`/`Tarea` → plantilla **historia**, rama `feature`. Cualquier otro tipo → `historia`.

Las dos plantillas tienen:
- La Fase 1 entre `<!-- DEVFLOW:FASE1:INICIO -->` y `<!-- DEVFLOW:FASE1:FIN -->`, regenerable sin tocar la Fase 2.
- Una variante de fallback: aviso `⚠️ Generado sin Ollama`, la descripción original y secciones "_Completar._".
- Preguntas abiertas como checklist.

### 6.2. Estrategia contra las alucinaciones

| Iteración | Cambio | Efecto |
|---|---|---|
| v1 | Reglas en el prompt: "usa solo el ticket", "No especificado en el ticket.", `preguntasAbiertas` | ✅ Tickets completos bien · ❌ en tickets escuetos ignora las reglas: en "No anda el login" inventó 'Credenciales incorrectas', "v1.2.3", "Chrome 95" y pasos |
| v2 | **`presenteEnTicket` como primer campo del schema** (el modelo clasifica antes de redactar) + **posprocesado determinista en código** + ejemplo corto de otro dominio | ✅ Los tickets escuetos dejan huecos marcados y generan preguntas en vez de inventar |
| v2 (ajuste) | `then` = comportamiento corregido, nunca el fallo; ejemplos de "entorno"; literales entre comillas sin traducir | ✅ Bug completo correcto · ⚠️ ver pendientes |

El **posprocesado determinista** forma parte del diseño, no es un parche. Irá en el `OllamaAITransformer` y sus reglas viven en `issue-types.json`:

- `siFalta`: si el modelo marca un dato como ausente, el código sobrescribe el campo con "No especificado en el ticket." y añade una pregunta fija.
- `verificarLiterales` (solo bugs: esperado, actual, entorno): si aparece un número o un texto entre comillas que no está en el ticket original, se descarta el campo.

### 6.3. Resultado final (`qwen2.5:3b`, prompts v2)

| Ticket | Tiempo | Resultado |
|---|---|---|
| bug-completo | 87 s | ✅ Pasos, esperado, actual (con mensaje literal) y entorno correctos; `Then` describe la corrección |
| bug-escueto | 35 s | ✅ Sin datos inventados; huecos marcados + preguntas · ⚠️ `Then` describe el error |
| historia-completa | 95 s | ✅ Traducida, un escenario por criterio, sin casos de uso inventados · ⚠️ omite el literal "Invalid date range" |
| historia-escueta | 32 s | ✅ "Como/Para: No especificado", preguntas por rol y criterios |

El script de prueba (`render-test.mjs`) quedó fuera del repo. Reproduce el flujo completo: fixture → mapeo de tipo → prompt → Ollama → validación con Ajv → posprocesado → documento con Handlebars.

---

## 7. Pendientes y cambios a volcar en `docs/`

### 7.1. Pendientes técnicos

1. **Tiempo de generación (riesgo principal):** streaming en la TUI, timeout de ~120 s, acortar el prompt o limitar escenarios, medir en un PC real de 8 GB.
2. **Bug sin comportamiento esperado:** el `Then` sigue describiendo el error. Propuesta: si `esperado` está ausente, el código pone `_Completar: comportamiento esperado_` en el `Then`.
3. **Literales de tickets en otro idioma:** ya no se traducen mal, pero el modelo los omite.
4. Decidir si `render-test.mjs` entra al repo como herramienta de evaluación de prompts (fuera de la suite normal de tests).
5. Commit de `finalproject-ANR/templates/` y de este documento en `feature/entrega-2-ANR`.

### 7.2. Cambios a reflejar en la documentación

| Documento | Cambio |
|---|---|
| `docs/003-modelo-de-datos.md` | `app_config`: + `jira_email`, + `tickets_root_path`, `ollama_timeout_seconds` default ~120, `ollama_model` sugerido `qwen2.5:3b`, prefijos de rama default `features`/`bugs`, + `branch_user_suffix`. `projects_config` → **`jira_projects` + `repositories`** (§8.4). `ticket_logs`: + `repository_id` (nullable), + `prompt_version`, `UNIQUE (ticket_id, repository_id)` con *upsert* en la reejecución. ERD actualizado |
| `docs/002-arquitectura-del-sistema.md` §2.2–2.3 | Jira REST Client: regla 404 → `/myself`, API v2, validación de clave con `/project/{key}`. Ollama AI Transformer: schema por tipo, posprocesado determinista, streaming. **Git Manager: amplía su alcance** — `git status`, pull de la rama base configurable y rama creada desde ella (§8.3); un repositorio por ejecución, elegido de la lista de la clave; diagrama de secuencia con la selección de repo; las épicas cortan el flujo. Árbol: `templates/prompts/`, `templates/documents/`, `issue-types.json`; carpeta `finalproject-ANR/` |
| `docs/001-descripcion-general-del-producto.md` | Una ejecución por repositorio, pero un ticket puede tener varios (una ejecución por cada uno, secuenciales); formato de rama `features/ID-USUARIO` / `bugs/ID-USUARIO`; lista de tickets asignados |
| `docs/ADR-001-arquitectura-inicial.md` + `CLAUDE.md` | El Git Manager ya no es "sin chequeos ni fetch/pull": hace `git status` y pull de la rama base antes de crear la rama. Registrar como cambio de decisión, con su motivo |
| `docs/005-historias-de-usuario.md` | US-01: alta de una o más claves validadas contra Jira, repositorios opcionales con nombre y sufijo de usuario. US-02: lista de tickets abiertos asignados; aviso de épica. US-03: elegir un repositorio por ejecución; `git status` + rama desde la rama base actualizada (configurable, default `main`); documento por repositorio |
| `docs/ADR-001` (ADR-003.1) | Modelo mínimo `qwen2.5:3b`, salida estructurada con `format`, posprocesado contra alucinaciones, timeout realista |
| `docs/008` (ADR-006.1) | Medición inicial de Ollama; la duración por ticket como riesgo; cerrar con las decisiones 7 y 8 de §2.1 |
| `docs/PRD.md` | Plantillas por tipo de issue (la "estructura idéntica" pasa a ser por tipo); ramas `features/ID-USUARIO` / `bugs/ID-USUARIO` según el tipo de issue; varios repositorios por ticket (una ejecución por cada uno); alta de claves de proyecto; épicas fuera del flujo; lista de tickets asignados |
| `docs/006-tickets-de-trabajo.md` | TK-01: nuevas tablas y métodos del Storage Manager (§8.4). TK-02: contratos de `DocumentoFase1` por tipo; JSON Schema como fuente de verdad (en lugar de Zod); regla 404; `GitManager` con `git status`, pull de la rama base configurable y creación desde ella; reutilización de la Fase 1 entre repositorios. TK-03: `devflow config proyectos`, `devflow start` sin ID con lista de tickets, selección de un repo, aviso de épica |
| `README.md` | Resúmenes de §2 y §3 alineados con lo anterior |

---

## 8. Proyectos de Jira, repositorios y ramas

> Requisitos definidos el 2026-10-03. Cambian decisiones previas: el Git Manager pasa a revisar el working directory y actualizar la rama base (antes "sin chequeos y sin fetch/pull"), y un ticket puede trabajarse en varios repositorios.

### 8.1. Requisitos

**Claves y repositorios**
- El usuario **da de alta desde la aplicación una o más claves de proyecto de Jira** (p. ej. `SCRUM`, `TC`). La herramienta solo trabaja con tickets de esas claves.
- Cada clave puede tener **cero, uno o varios repositorios**, opcionales y configurados por el usuario con un **nombre** (p. ej. `backend`, `frontend`) y su ruta local.

**Ejecución: un repositorio por vez**
- En cada ejecución el usuario **elige un repositorio**: el que va a modificar.
- Si el ticket toca varios (p. ej. backend y frontend), se ejecuta **primero con uno y después con el otro**. No se procesan en paralelo.
- Hay **un documento (y su carpeta de adjuntos) por repositorio**.

**Ramas**
- Formato: **`<prefijo>/<ID-ticket>-<USUARIO>`**. Ejemplos: `features/SCRUM-1-AROCHA`, `bugs/SCRUM-2-AROCHA`.
- Prefijo según el tipo de issue: Bug/Error → `bugs`, el resto → `features`.
- Se crea desde la **rama base que el usuario configura para cada repositorio** (por defecto `main`; puede ser `develop`, `master`, etc.), **con los últimos cambios** (pull previo), sin importar en qué rama esté el desarrollador.
- Antes de nada se ejecuta **`git status`**: solo si **no hay cambios pendientes** se hace el pull y se crea la rama.
- Si la rama ya existe en ese repositorio, se informa y se continúa.

**Tipos de issue**
- **Las épicas no generan documento ni rama**: no se usan para desarrollar. Se avisa: "SCRUM-X es una épica; no hay plantilla para épicas. Elige una historia, tarea o bug".
- **Las subtareas se tratan como historias** (misma plantilla y prompt, rama `features/`).

**Selección de ticket**
- `devflow start` sin ID muestra la **lista de tickets abiertos asignados al usuario** dentro de sus claves, para elegir uno.

### 8.2. Validaciones contra Jira (probadas el 2026-10-03)

| Prueba | Resultado | Uso en la aplicación |
|---|---|---|
| `GET /rest/api/2/project/SCRUM` | 200 → `key`, `name` ("Mi Team"), `issueTypes` | Validar la clave al darla de alta y guardar su nombre |
| `GET /project/NOEXISTE` | 404 | Clave inválida → se rechaza el alta |
| `GET /project/SCRUM` con token inválido | **404** | Igual que en §3.3: ante un 404, confirmar con `/myself` antes de decir "la clave no existe" |
| JQL con una clave inexistente | **200 sin error** (Jira la ignora sin avisar) | Por eso la validación tiene que hacerse en el alta, no al buscar |
| JQL `project in (…) AND assignee = currentUser() AND statusCategory != Done AND issuetype != Epic ORDER BY updated DESC` | 200 → `SCRUM-2` (Error), `SCRUM-1` (Historia) | Lista de `devflow start` sin ID |
| `GET /myself` → `displayName` "Andrea Rocha" | Sufijo sugerido **`AROCHA`** (inicial del nombre + último apellido, sin acentos, mayúsculas) | Valor propuesto al configurar el sufijo; el usuario lo confirma o lo cambia |

Tipos de issue del proyecto `SCRUM`: `Epic`, `Subtarea`, `Tarea`, `Historia`, `Error`. Ticket real de tipo bug disponible para pruebas: **SCRUM-2** ("El botón Aceptar desaparece al actualizar el campo Importe").

### 8.3. Flujo propuesto

**Alta (`devflow config`)**

1. **Sufijo de usuario** para las ramas: se sugiere a partir de `/myself` (`AROCHA`) y el usuario lo confirma o lo edita. Formato `^[A-Z0-9]+$`.
2. **Claves de proyecto** (`devflow config proyectos`: agregar, listar, editar, quitar):
   1. Ingresar la clave; se normaliza a mayúsculas y se valida el formato `^[A-Z][A-Z0-9_]+$`.
   2. Se valida contra Jira (`/project/{clave}`) y se guarda con su nombre ("SCRUM — Mi Team").
   3. Opcional: agregar repositorios: nombre, ruta local y **rama base desde la que nacen las ramas nuevas** (el usuario la escribe; por defecto `main`). Se valida que la ruta sea un repo Git con remoto `origin` y que la rama base exista en el remoto.
   4. "¿Agregar otro repositorio?" / "¿Agregar otra clave?".
3. No se puede iniciar ningún ticket sin al menos una clave dada de alta.

**Inicio (`devflow start [ID]`)**

1. **Sin ID** → lista de tickets abiertos asignados al usuario en sus claves (JQL de §8.2), y elige uno. **Con ID** → el prefijo debe ser una clave dada de alta; si no, error antes de llamar a Jira: "XYZ no está configurado; claves disponibles: …".
2. Jira → contexto del ticket. **Si es una épica, se avisa y el flujo termina** (sin rama ni documento).
3. **Elegir un repositorio** de la clave (selección simple). Si la clave tiene un solo repo, aparece preseleccionado.
4. **Git Manager** sobre ese repositorio (ejemplo con rama base `main`):
   1. Verifica que el repo exista.
   2. **`git status --porcelain`**: si hay **cambios pendientes** (modificados, staged o sin trackear), se detiene ahí y lista los archivos. El desarrollador debe commitearlos o guardarlos con `stash` y volver a ejecutar. Esto evita que `git switch -c` arrastre esos cambios a la rama nueva.
   3. Si la rama `bugs/SCRUM-2-AROCHA` ya existe → se informa y se continúa con la carpeta y el documento, sin pull ni creación.
   4. **Pull de la rama base**, por si algo no se bajó del remoto, sin importar la rama actual:
      - Si está en la rama base: `git pull --ff-only origin main`.
      - Si está en otra rama: `git fetch origin main:main` (avanza la rama base local sin cambiarse de rama).
   5. Crea la rama desde la rama base actualizada: `git switch -c bugs/SCRUM-2-AROCHA main`.
   6. Si el pull falla (sin red, rama base local con commits propios que divergen del remoto, credenciales Git) → **error bloqueante para esa ejecución**, sin crear la rama desde una base vieja.
   7. Sigue sin hacer `commit`, `add` ni `push`.
   8. Para una ejecución puntual con otra base se puede usar `devflow start SCRUM-2 --base develop`, sin cambiar la configuración del repo.
5. **Carpeta y documento de ese repositorio** (§8.4).
6. Para el otro repositorio del mismo ticket, se vuelve a ejecutar `devflow start SCRUM-2` y se elige el otro.

**Estructura de carpetas (fuera del repositorio Git, ADR-004.1)**

```
%USERPROFILE%\DevFlowCLI\tickets\
└── SCRUM-2\
    ├── .devflow\fase1.json          # resultado de Ollama, reutilizado entre repositorios
    ├── backend\
    │   ├── SCRUM-2-backend.md       # rama bugs/SCRUM-2-AROCHA en el repo backend
    │   └── adjuntos\
    └── frontend\
        ├── SCRUM-2-frontend.md
        └── adjuntos\
```

**Reutilización de la Fase 1 (confirmada):** el análisis de Ollama depende del ticket, no del repositorio. La primera ejecución lo guarda en `.devflow/fase1.json`; la segunda (otro repo) **copia la misma Fase 1** en su documento en vez de volver a esperar 30–100 s a Ollama (`ollama_status = 'reused'`). Se regenera solo si el usuario lo pide o si la primera vez cayó en fallback.

### 8.4. Modelo de datos propuesto (reemplaza `projects_config`)

```sql
-- Claves de proyecto de Jira dadas de alta por el usuario
CREATE TABLE jira_projects (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    jira_project_key    TEXT    NOT NULL UNIQUE,      -- 'SCRUM'
    jira_project_name   TEXT    NOT NULL,             -- 'Mi Team' (validado contra Jira en el alta)
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Repositorios locales asociados a una clave (0..N por clave)
CREATE TABLE repositories (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    jira_project_id     INTEGER NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    name                TEXT    NOT NULL,             -- 'backend', 'frontend'
    repo_local_path     TEXT    NOT NULL,
    default_base_branch TEXT    NOT NULL DEFAULT 'main', -- rama desde la que nacen las nuevas; la elige el usuario
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (jira_project_id, name)
);

-- Una fila por ticket y repositorio (cada ejecución trabaja sobre un repositorio)
CREATE TABLE ticket_logs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id           TEXT    NOT NULL,             -- 'SCRUM-2'
    jira_project_id     INTEGER NOT NULL REFERENCES jira_projects(id),
    repository_id       INTEGER REFERENCES repositories(id),  -- NULL si la clave no tiene repos
    issue_type          TEXT    NOT NULL,             -- tipo de Jira tal cual ('Error', 'Historia'…)
    branch_type         TEXT    NOT NULL CHECK (branch_type IN ('feature', 'bugfix')),
    branch_name         TEXT,                         -- 'bugs/SCRUM-2-AROCHA'; NULL sin repositorio
    base_branch         TEXT,                         -- rama base usada en esta ejecución ('main', 'develop'…)
    branch_status       TEXT    CHECK (branch_status IN ('created', 'already_existed', 'pending_changes', 'error')),
    jira_fetch_status   TEXT    NOT NULL CHECK (jira_fetch_status IN ('ok', 'fallback_manual')),
    jira_fetch_error    TEXT,
    ollama_status       TEXT    NOT NULL CHECK (ollama_status IN ('ok', 'fallback_deterministic', 'reused')),
    ollama_error        TEXT,
    prompt_version      TEXT,                         -- 'bug-v2'
    folder_path         TEXT    NOT NULL,
    document_path       TEXT    NOT NULL,
    started_at          DATETIME NOT NULL,
    finished_at         DATETIME,
    UNIQUE (ticket_id, repository_id)                 -- upsert al reejecutar
);
```

`app_config`:
- **`branch_user_suffix`** (`AROCHA`).
- Los defaults de `branch_prefix_feature` / `branch_prefix_bugfix` pasan a **`features`** / **`bugs`**.
- Se suman `jira_email` y `tickets_root_path` de §2.1/§3.4.

> Nota SQLite: `UNIQUE (ticket_id, repository_id)` no impide duplicados cuando `repository_id` es `NULL`; el *upsert* del Storage Manager tiene que tratar ese caso aparte.

### 8.5. Impacto en decisiones y contratos previos

| Antes | Ahora |
|---|---|
| Git Manager "sin chequeos del working directory, sin `fetch`/`pull`" (ADR-001, `002`, CLAUDE.md) | `git status` (con cambios pendientes no continúa) + pull de la rama base (`pull --ff-only` o `fetch origin <base>:<base>`); si no puede actualizar, bloquea |
| Rama desde donde esté el desarrollador | Desde la rama base configurada por repo (default `main`), actualizada; override puntual con `--base` |
| Rama `feature\|bugfix/ID-resumen` | `features\|bugs/ID-USUARIO` |
| `projects_config`: una fila = clave + repo | `jira_projects` (1) → `repositories` (0..N) |
| Un documento por ticket | **Un documento por ticket y repositorio**; la Fase 1 se reutiliza entre repos |
| Todos los tipos de issue generan documento | Las épicas cortan el flujo con un aviso |
| `devflow start <ID>` obligatorio | `devflow start` sin ID muestra los tickets asignados |
| Plantilla: variable `rama` | Variables `repo` y `rama` (plantillas ya actualizadas) |

### 8.6. Decisiones cerradas el 2026-10-03

| # | Tema | Decisión |
|---|---|---|
| 1 | Cambios sin commitear | `git status`; **solo si no hay cambios pendientes** se hace el pull y se crea la rama. Con cambios, se detiene y los lista (asumido: no se ofrece `stash` automático) |
| 2 | `Subtarea` | Se trata como historia (ya mapeada en `issue-types.json`) |
| 4 | Reutilización de la Fase 1 | Sí: el segundo repositorio copia la misma Fase 1 del primero |
| 5 | Rama base | La define el usuario por repositorio (default `main`), con override puntual `--base` |

### 8.7. Decisiones cerradas el 2026-10-03 (continuación)

| # | Tema | Decisión |
|---|---|---|
| 3 | Clave sin repositorios | **Solo documento**: se genera en `SCRUM-1/` (sin subcarpeta de repo), sin rama ni pasos de Git |
| 6 | Pasos escritos como cadena con flechas | Prompt de bug ajustado (`bug-v3`): una secuencia separada por `→`, `->`, `>` o "luego" cuenta como pasos, y se crea un paso por tramo más la acción que provoca el fallo |

**Resultado de `bug-v3`** (`qwen2.5:3b`, 2026-10-03):

| Ticket | Pasos | Observaciones |
|---|---|---|
| SCRUM-2 (real, con flechas) | ✅ Reconocidos: Facturas → Seleccionar factura → Editar → Borrar Importe | ⚠️ Agrega un 5.º paso "Presionar Aceptar", que no corresponde: el botón es justamente el que desaparece |
| bug-escueto | ✅ No inventa pasos | ⚠️ El `Then` sigue describiendo el error cuando falta el comportamiento esperado (pendiente §7.1.2) |
| bug-completo | ✅ Sin cambios | ⚠️ Esta vez marcó `entorno: false` con "Ambiente de QA, versión 2.14.3" en el ticket: el modelo de 3B no es estable en esa clasificación entre ejecuciones |

Mejora posible para el entorno: detección determinista en código. Si la descripción tiene un encabezado o palabra clave (`Entorno`, `Ambiente`, `Versión`, `Environment`) y el modelo marcó `entorno: false`, no se sobrescribe el campo y se agrega una pregunta de verificación.
